import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleValidationErrors, asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../services/DatabaseService';
import { WebhookService } from '../services/WebhookService';
import { ApiResponse } from '../Types/api';

const router = Router();
const dbService = new DatabaseService();
const webhookService = new WebhookService();

/**
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: Get user webhooks
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Webhooks retrieved successfully
 */
router.get('/', asyncHandler(async (req, res) => {
  const webhooks = await dbService.getUserWebhooks(req.user!.id);

  res.json({
    success: true,
    data: webhooks,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *               secret:
 *                 type: string
 *     responses:
 *       201:
 *         description: Webhook created successfully
 */
router.post('/', [
  body('url').isURL(),
  body('events').isArray({ min: 1 }),
  body('events.*').isString().notEmpty(),
  body('secret').optional().isString()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { url, events, secret } = req.body;

  const webhook = await dbService.createWebhook({
    userId: req.user!.id,
    url,
    events,
    secret
  });

  res.status(201).json({
    success: true,
    data: webhook,
    message: 'Webhook created successfully',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/webhooks/{webhookId}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deleted successfully
 */
router.delete('/:webhookId', [
  param('webhookId').notEmpty()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { webhookId } = req.params;

  await dbService.deleteWebhook(webhookId);

  res.json({
    success: true,
    message: 'Webhook deleted successfully',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /api/webhooks/{webhookId}/test:
 *   post:
 *     summary: Test a webhook
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook test completed
 */
router.post('/:webhookId/test', [
  param('webhookId').notEmpty()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { webhookId } = req.params;

  const success = await webhookService.testWebhook(webhookId);

  res.json({
    success: true,
    data: { testSuccess: success },
    message: success ? 'Webhook test successful' : 'Webhook test failed',
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

export default router;
