import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';
import { sessionMiddleware } from '../middleware/auth';
import { whatsAppService } from '../app';
import { DatabaseService } from '../services/DatabaseService';
import { ApiResponse, SendMessageRequest, MessageType } from '../Types/api';
import { downloadContentFromMessage } from '../Utils/messages-media';

const router = Router();
const dbService = new DatabaseService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024, // 50MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow common media types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});

/**
 * @swagger
 * /api/messages/{sessionId}:
 *   get:
 *     summary: Get messages for a session
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: chatId
 *         schema:
 *           type: string
 *         description: Filter by specific chat
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 */
router.get('/:sessionId', [
  param('sessionId').notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { chatId, limit = 50, offset = 0 } = req.query;

  const messages = await dbService.getMessages(
    sessionId,
    chatId as string,
    parseInt(limit as string),
    parseInt(offset as string)
  );

  res.json({
    success: true,
    data: messages,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/messages/{sessionId}/send:
 *   post:
 *     summary: Send a text message
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - content
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient JID
 *               content:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *               options:
 *                 type: object
 *                 properties:
 *                   quoted:
 *                     type: string
 *                   mentions:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/:sessionId/send', [
  param('sessionId').notEmpty(),
  body('to').notEmpty().trim(),
  body('content.text').notEmpty().trim(),
  body('options.quoted').optional().isString(),
  body('options.mentions').optional().isArray()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, content, options = {} } = req.body;

  try {
    const messageContent: any = { text: content.text };
    
    if (options.quoted) {
      messageContent.quoted = options.quoted;
    }
    
    if (options.mentions && options.mentions.length > 0) {
      messageContent.mentions = options.mentions;
    }

    const result = await whatsAppService.sendMessage(sessionId, to, messageContent);

    res.json({
      success: true,
      data: result,
      message: 'Message sent successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
}));

/**
 * @swagger
 * /api/messages/{sessionId}/send-media:
 *   post:
 *     summary: Send a media message
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - file
 *             properties:
 *               to:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 *               fileName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Media message sent successfully
 */
router.post('/:sessionId/send-media', upload.single('file'), [
  param('sessionId').notEmpty(),
  body('to').notEmpty().trim(),
  body('caption').optional().trim(),
  body('fileName').optional().trim()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, caption, fileName } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    let messageContent: any;
    const mediaBuffer = file.buffer;
    const mimetype = file.mimetype;

    if (mimetype.startsWith('image/')) {
      messageContent = {
        image: mediaBuffer,
        caption,
        fileName: fileName || file.originalname
      };
    } else if (mimetype.startsWith('video/')) {
      messageContent = {
        video: mediaBuffer,
        caption,
        fileName: fileName || file.originalname
      };
    } else if (mimetype.startsWith('audio/')) {
      messageContent = {
        audio: mediaBuffer,
        fileName: fileName || file.originalname,
        mimetype
      };
    } else {
      messageContent = {
        document: mediaBuffer,
        fileName: fileName || file.originalname,
        mimetype
      };
    }

    const result = await whatsAppService.sendMessage(sessionId, to, messageContent);

    res.json({
      success: true,
      data: result,
      message: 'Media message sent successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
}));

/**
 * @swagger
 * /api/messages/{sessionId}/send-location:
 *   post:
 *     summary: Send a location message
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - latitude
 *               - longitude
 *             properties:
 *               to:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Location message sent successfully
 */
router.post('/:sessionId/send-location', [
  param('sessionId').notEmpty(),
  body('to').notEmpty().trim(),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('name').optional().trim(),
  body('address').optional().trim()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, latitude, longitude, name, address } = req.body;

  try {
    const messageContent = {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name,
        address
      }
    };

    const result = await whatsAppService.sendMessage(sessionId, to, messageContent);

    res.json({
      success: true,
      data: result,
      message: 'Location message sent successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
}));

/**
 * @swagger
 * /api/messages/{sessionId}/send-reaction:
 *   post:
 *     summary: Send a reaction to a message
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - messageId
 *               - emoji
 *             properties:
 *               to:
 *                 type: string
 *               messageId:
 *                 type: string
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction sent successfully
 */
router.post('/:sessionId/send-reaction', [
  param('sessionId').notEmpty(),
  body('to').notEmpty().trim(),
  body('messageId').notEmpty().trim(),
  body('emoji').notEmpty().trim()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { to, messageId, emoji } = req.body;

  try {
    const messageContent = {
      react: {
        text: emoji,
        key: {
          remoteJid: to,
          id: messageId
        }
      }
    };

    const result = await whatsAppService.sendMessage(sessionId, to, messageContent);

    res.json({
      success: true,
      data: result,
      message: 'Reaction sent successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
}));

export default router;
