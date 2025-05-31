import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';
import { Boom } from '@hapi/boom';
import { logger } from '../Utils/apiLogger';
import { ApiError } from '../Types/api';

export const errorHandler = (
  error: Error | ApiError | Boom,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error({
    err: error,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    }
  }, 'Error occurred');

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof Boom) {
    statusCode = error.output.statusCode;
    message = error.message;
    code = error.data?.code || 'BOOM_ERROR';
    details = error.data;
  } else if ('statusCode' in error && error.statusCode) {
    // Custom API Error
    statusCode = error.statusCode;
    message = error.message;
    code = (error as ApiError).code || 'API_ERROR';
    details = (error as ApiError).details;
  } else if (error.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  } else if (error.name === 'CastError') {
    // Mongoose cast error
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    // Duplicate key error
    statusCode = 409;
    message = 'Duplicate entry';
    code = 'DUPLICATE_ENTRY';
    details = (error as any).keyValue;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = getMulterErrorMessage(error as any);
    code = 'FILE_UPLOAD_ERROR';
  } else if (error.message.includes('ENOENT')) {
    statusCode = 404;
    message = 'File not found';
    code = 'FILE_NOT_FOUND';
  } else if (error.message.includes('EACCES')) {
    statusCode = 403;
    message = 'Permission denied';
    code = 'PERMISSION_DENIED';
  } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
    statusCode = 503;
    message = 'Too many open files';
    code = 'TOO_MANY_FILES';
  } else if (error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service unavailable';
    code = 'SERVICE_UNAVAILABLE';
  } else if (error.message.includes('timeout')) {
    statusCode = 408;
    message = 'Request timeout';
    code = 'TIMEOUT';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
    details = undefined;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack
    })
  });
};

// Handle validation errors from express-validator
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((error: ValidationError) => ({
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Handle async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create custom API error
export const createApiError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

// Handle 404 errors
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  });
};

// Get user-friendly message for Multer errors
const getMulterErrorMessage = (error: any): string => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return 'File too large';
    case 'LIMIT_FILE_COUNT':
      return 'Too many files';
    case 'LIMIT_FIELD_KEY':
      return 'Field name too long';
    case 'LIMIT_FIELD_VALUE':
      return 'Field value too long';
    case 'LIMIT_FIELD_COUNT':
      return 'Too many fields';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Unexpected file field';
    case 'MISSING_FIELD_NAME':
      return 'Missing field name';
    default:
      return 'File upload error';
  }
};

// WhatsApp specific error handler
export const handleWhatsAppError = (error: any): ApiError => {
  if (error instanceof Boom) {
    return createApiError(
      error.message,
      error.output.statusCode,
      'WHATSAPP_ERROR',
      { boom: error.data }
    );
  }

  if (error.message?.includes('not-authorized')) {
    return createApiError(
      'WhatsApp session not authorized',
      401,
      'SESSION_NOT_AUTHORIZED'
    );
  }

  if (error.message?.includes('connection')) {
    return createApiError(
      'WhatsApp connection error',
      503,
      'CONNECTION_ERROR'
    );
  }

  if (error.message?.includes('rate-limit')) {
    return createApiError(
      'WhatsApp rate limit exceeded',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  return createApiError(
    error.message || 'WhatsApp operation failed',
    500,
    'WHATSAPP_ERROR',
    { originalError: error.message }
  );
};
