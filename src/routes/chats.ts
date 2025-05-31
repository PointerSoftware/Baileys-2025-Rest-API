import { Router } from 'express';
import { param, body } from 'express-validator';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';
import { sessionMiddleware } from '../middleware/auth';
import { whatsAppService } from '../app';
import { DatabaseService } from '../services/DatabaseService';
import { ApiResponse } from '../Types/api';

const router = Router();
const dbService = new DatabaseService();

/**
 * @swagger
 * /api/chats/{sessionId}:
 *   get:
 *     summary: Get all chats for a session
 *     tags: [Chats]
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
 *         description: Chats retrieved successfully
 */
router.get('/:sessionId', [
  param('sessionId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const chats = await dbService.getChats(sessionId);

  res.json({
    success: true,
    data: chats,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/chats/{sessionId}/{chatId}/archive:
 *   post:
 *     summary: Archive a chat
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat archived successfully
 */
router.post('/:sessionId/:chatId/archive', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    // You must provide lastMessages for archive/unarchive actions
    await session.socket.chatModify({ archive: true, lastMessages: [] }, chatId);

    // Update in database
    await dbService.upsertChat({
      sessionId,
      jid: chatId,
      isGroup: chatId.endsWith('@g.us'),
      isArchived: true
    });

    res.json({
      success: true,
      message: 'Chat archived successfully',
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
 * /api/chats/{sessionId}/{chatId}/unarchive:
 *   post:
 *     summary: Unarchive a chat
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat unarchived successfully
 */
router.post('/:sessionId/:chatId/unarchive', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    await session.socket.chatModify({ archive: false, lastMessages: [] }, chatId);

    // Update in database
    await dbService.upsertChat({
      sessionId,
      jid: chatId,
      isGroup: chatId.endsWith('@g.us'),
      isArchived: false
    });

    res.json({
      success: true,
      message: 'Chat unarchived successfully',
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
 * /api/chats/{sessionId}/{chatId}/pin:
 *   post:
 *     summary: Pin a chat
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat pinned successfully
 */
router.post('/:sessionId/:chatId/pin', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    await session.socket.chatModify({ pin: true }, chatId);

    // Update in database
    await dbService.upsertChat({
      sessionId,
      jid: chatId,
      isGroup: chatId.endsWith('@g.us'),
      isPinned: true
    });

    res.json({
      success: true,
      message: 'Chat pinned successfully',
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
 * /api/chats/{sessionId}/{chatId}/unpin:
 *   post:
 *     summary: Unpin a chat
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat unpinned successfully
 */
router.post('/:sessionId/:chatId/unpin', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    await session.socket.chatModify({ pin: false }, chatId);

    // Update in database
    await dbService.upsertChat({
      sessionId,
      jid: chatId,
      isGroup: chatId.endsWith('@g.us'),
      isPinned: false
    });

    res.json({
      success: true,
      message: 'Chat unpinned successfully',
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
 * /api/chats/{sessionId}/{chatId}/delete:
 *   delete:
 *     summary: Delete a chat
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 */
router.delete('/:sessionId/:chatId/delete', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    await session.socket.chatModify({ delete: true, lastMessages: [] }, chatId);

    res.json({
      success: true,
      message: 'Chat deleted successfully',
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
 * /api/chats/{sessionId}/{chatId}/mark-read:
 *   post:
 *     summary: Mark chat as read
 *     tags: [Chats]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat marked as read successfully
 */
router.post('/:sessionId/:chatId/mark-read', [
  param('sessionId').notEmpty(),
  param('chatId').notEmpty()
], sessionMiddleware, handleValidationErrors, asyncHandler(async (req, res) => {
  const { sessionId, chatId } = req.params;

  const session = await whatsAppService.getSession(sessionId);
  if (!session?.socket) {
    return res.status(400).json({
      success: false,
      error: 'Session not connected',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }

  try {
    await session.socket.chatModify({ markRead: true, lastMessages: [] }, chatId);

    // Update in database
    await dbService.upsertChat({
      sessionId,
      jid: chatId,
      isGroup: chatId.endsWith('@g.us'),
      unreadCount: 0
    });

    res.json({
      success: true,
      message: 'Chat marked as read successfully',
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
