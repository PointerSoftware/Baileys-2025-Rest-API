import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';
import { sessionMiddleware } from '../middleware/auth';
import { whatsAppService } from '../app';
import { DatabaseService } from '../services/DatabaseService';
import { ApiResponse, SessionStatus } from '../Types/api';
import { setTimeout } from 'timers/promises';

const router = Router();
const dbService = new DatabaseService();

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all user sessions
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 */
router.get('/', asyncHandler(async (req, res) => {
  const sessions = await dbService.getUserSessions(req.user!.id);

  // Enhance with real-time status from WhatsApp service
  const enhancedSessions = await Promise.all(sessions.map(async session => {
    const liveSession = await whatsAppService.getSession(session.sessionId);
    return {
      ...session,
      liveStatus: liveSession?.status || SessionStatus.DISCONNECTED,
      qrCode: liveSession?.qrCode,
      pairingCode: liveSession?.pairingCode
    };
  }));

  res.json({
    success: true,
    data: enhancedSessions,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new WhatsApp session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Unique session identifier
 *               usePairingCode:
 *                 type: boolean
 *                 default: false
 *                 description: Use pairing code instead of QR code
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Session already exists
 */
router.post('/', [
  body('sessionId').notEmpty().trim().isLength({ min: 1, max: 50 }),
  body('usePairingCode').optional().isBoolean()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, usePairingCode = false } = req.body;

  // Check if session already exists
  const existingSession = await dbService.getSession(sessionId);
  if (existingSession) {
    return res.status(400).json({
      success: false,
      error: 'Session already exists',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  // Create session
  await whatsAppService.createSession(sessionId, req.user!.id, usePairingCode);

  // Tambahkan delay agar QR/pairing code sempat terisi
  await setTimeout(10000); // delay 2 detik, bisa disesuaikan

  // Ambil session terbaru dari database
  const dbSession = await dbService.getSession(sessionId);

  if (usePairingCode == true) {
    return res.status(201).json({
      success: true,
      data: {
        status: dbSession?.status
      },
      qrCode: dbSession?.pairingCode,
      message: 'Session created successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
  res.status(201).json({
    success: true,
    data: {
      status: dbSession?.status
    },
    qrCode: dbSession?.qrCode,
    message: 'Session created successfully',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get session details
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const dbSession = await dbService.getSession(sessionId);
  const liveSession = await whatsAppService.getSession(sessionId);

  if (!dbSession) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  const sessionData = {
    ...dbSession,
    liveStatus: liveSession?.status || SessionStatus.DISCONNECTED,
    qrCode: liveSession?.qrCode,
    pairingCode: liveSession?.pairingCode
  };

  res.json({
    success: true,
    data: sessionData,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted successfully
 *       404:
 *         description: Session not found
 */
router.delete('/:sessionId', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  await whatsAppService.deleteSession(sessionId);

  res.json({
    success: true,
    message: 'Session deleted successfully',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions/{sessionId}/qr:
 *   get:
 *     summary: Get QR code for session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code retrieved successfully
 *       404:
 *         description: Session not found or QR code not available
 */
router.get('/:sessionId/qr', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await whatsAppService.getSession(sessionId);

  if (!session || !session.qrCode) {
    return res.status(404).json({
      success: false,
      error: 'QR code not available',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  res.json({
    success: true,
    data: {
      qrCode: session.qrCode,
      status: session.status
    },
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions/{sessionId}/pairing-code:
 *   post:
 *     summary: Request pairing code for session
 *     tags: [Sessions]
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
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number in international format
 *     responses:
 *       200:
 *         description: Pairing code generated successfully
 *       400:
 *         description: Invalid phone number or session not ready
 */
router.post('/:sessionId/pairing-code', [
  param('sessionId').notEmpty(),
  body('phoneNumber').isMobilePhone('any').withMessage('Invalid phone number')
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { phoneNumber } = req.body;

  try {
    const pairingCode = await whatsAppService.requestPairingCode(sessionId, phoneNumber);

    res.json({
      success: true,
      data: {
        pairingCode,
        phoneNumber,
        sessionId
      },
      message: 'Pairing code generated successfully',
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
 * /api/sessions/{sessionId}/status:
 *   get:
 *     summary: Get session connection status
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session status retrieved successfully
 */
router.get('/:sessionId/status', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  const dbSession = await dbService.getSession(sessionId);

  res.json({
    success: true,
    data: {
      sessionId,
      status: session?.status || SessionStatus.DISCONNECTED,
      phoneNumber: session?.phoneNumber || dbSession?.phoneNumber,
      name: session?.name || dbSession?.name,
      lastSeen: session?.lastSeen || dbSession?.lastSeen,
      isConnected: session?.status === SessionStatus.CONNECTED
    },
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/sessions/{sessionId}/restart:
 *   post:
 *     summary: Restart a session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session restart initiated
 */
router.post('/:sessionId/restart', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  // Delete and recreate session
  await whatsAppService.deleteSession(sessionId);
  const newSession = await whatsAppService.createSession(sessionId, req.user!.id);

  res.json({
    success: true,
    data: newSession,
    message: 'Session restart initiated',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

export default router;
