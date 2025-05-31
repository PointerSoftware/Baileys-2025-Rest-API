import { Router } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { DatabaseService } from '../services/DatabaseService';
import { whatsAppService } from '../app';
import { ApiResponse } from '../Types/api';

const router = Router();
const dbService = new DatabaseService();

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
  const stats = await dbService.getDashboardStats(req.user!.id);

  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

/**
 * @swagger
 * /dashboard/sessions:
 *   get:
 *     summary: Get session metrics for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Session metrics retrieved successfully
 */
router.get('/sessions', authMiddleware, asyncHandler(async (req, res) => {
  const sessions = await dbService.getUserSessions(req.user!.id);
  
  const sessionMetrics = await Promise.all(sessions.map(async session => {
    const liveSession = await whatsAppService.getSession(session.sessionId);
    return {
      sessionId: session.sessionId,
      status: liveSession?.status || session.status,
      phoneNumber: session.phoneNumber,
      name: session.name,
      lastSeen: session.lastSeen,
      createdAt: session.createdAt
    };
  }));

  res.json({
    success: true,
    data: sessionMetrics,
    timestamp: new Date().toISOString()
  } as ApiResponse);
}));

// Serve dashboard HTML
router.get('/', (req, res) => {
  const dashboardPath = join(__dirname, '../../frontend/dist/index.html');
  
  if (existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    // Fallback simple dashboard
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Baileys API Dashboard</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #f5f5f5;
              }
              .container {
                  max-width: 1200px;
                  margin: 0 auto;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  padding: 30px;
              }
              h1 {
                  color: #333;
                  margin-bottom: 30px;
              }
              .nav {
                  display: flex;
                  gap: 20px;
                  margin-bottom: 30px;
                  border-bottom: 1px solid #eee;
                  padding-bottom: 20px;
              }
              .nav a {
                  color: #007bff;
                  text-decoration: none;
                  padding: 10px 15px;
                  border-radius: 5px;
                  transition: background-color 0.2s;
              }
              .nav a:hover {
                  background-color: #f8f9fa;
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
              }
              .stat-card {
                  background: #f8f9fa;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #007bff;
              }
              .stat-value {
                  font-size: 2em;
                  font-weight: bold;
                  color: #007bff;
              }
              .stat-label {
                  color: #666;
                  margin-top: 5px;
              }
              .section {
                  margin-bottom: 30px;
              }
              .section h2 {
                  color: #333;
                  border-bottom: 2px solid #007bff;
                  padding-bottom: 10px;
              }
              .api-info {
                  background: #e7f3ff;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #007bff;
              }
              .code {
                  background: #f1f1f1;
                  padding: 10px;
                  border-radius: 4px;
                  font-family: 'Courier New', monospace;
                  margin: 10px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🚀 Baileys WhatsApp API Dashboard</h1>
              
              <div class="nav">
                  <a href="/api-docs">📚 API Documentation</a>
                  <a href="/health">❤️ Health Check</a>
                  <a href="https://github.com/WhiskeySockets/Baileys" target="_blank">📖 Baileys Docs</a>
              </div>

              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-value" id="totalSessions">-</div>
                      <div class="stat-label">Total Sessions</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="activeSessions">-</div>
                      <div class="stat-label">Active Sessions</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="totalMessages">-</div>
                      <div class="stat-label">Total Messages</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="apiCalls">-</div>
                      <div class="stat-label">API Calls (24h)</div>
                  </div>
              </div>

              <div class="section">
                  <h2>🔑 Quick Start</h2>
                  <div class="api-info">
                      <p><strong>API Base URL:</strong> <span class="code">${process.env.API_BASE_URL || 'http://localhost:3001'}</span></p>
                      <p><strong>Authentication:</strong> Use your API key in the <code>X-API-Key</code> header</p>
                      <p><strong>Documentation:</strong> <a href="/api-docs">Interactive API Documentation</a></p>
                  </div>
              </div>

              <div class="section">
                  <h2>📱 Sessions</h2>
                  <div id="sessionsList">
                      <p>Loading sessions...</p>
                  </div>
              </div>

              <div class="section">
                  <h2>🔗 Example API Calls</h2>
                  <div class="api-info">
                      <h4>Create a new session:</h4>
                      <div class="code">
POST /api/sessions<br>
Content-Type: application/json<br>
X-API-Key: YOUR_API_KEY<br><br>
{<br>
&nbsp;&nbsp;"sessionId": "my-session-1",<br>
&nbsp;&nbsp;"usePairingCode": false<br>
}
                      </div>

                      <h4>Send a message:</h4>
                      <div class="code">
POST /api/messages/my-session-1/send<br>
Content-Type: application/json<br>
X-API-Key: YOUR_API_KEY<br><br>
{<br>
&nbsp;&nbsp;"to": "1234567890@s.whatsapp.net",<br>
&nbsp;&nbsp;"content": {<br>
&nbsp;&nbsp;&nbsp;&nbsp;"text": "Hello from Baileys API!"<br>
&nbsp;&nbsp;}<br>
}
                      </div>
                  </div>
              </div>
          </div>

          <script>
              // Load dashboard data
              async function loadDashboardData() {
                  try {
                      // This would need proper authentication in a real implementation
                      console.log('Dashboard loaded - implement API calls with proper authentication');
                  } catch (error) {
                      console.error('Error loading dashboard data:', error);
                  }
              }

              loadDashboardData();
          </script>
      </body>
      </html>
    `);
  }
});

export default router;
