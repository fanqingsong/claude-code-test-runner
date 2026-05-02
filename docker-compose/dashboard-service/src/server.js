/**
 * Dashboard Service - Express Server
 * Connects to PostgreSQL and serves the test analytics dashboard
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ejs from 'ejs';
import { readFile } from 'fs/promises';
import jwt from 'jsonwebtoken';
import { DatabaseManager } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class DashboardService {
  constructor(port = 8003) {
    this.port = port;
    this.app = express();
    this.db = new DatabaseManager();

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(join(process.cwd(), 'public')));

    // Serve React frontend in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(join(process.cwd(), 'frontend/dist')));
    }
    // In development mode, Vite dev server handles frontend directly
    // Backend API routes are still served by Express

    // CORS headers - handle preflight requests explicitly
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // Respond to preflight requests immediately
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });
  }

  /**
   * Verify JWT token and extract user information
   */
  async verifyToken(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY || 'your-secret-key');
      return decoded;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin(user) {
    if (!user) return false;
    // Check if user has admin role in Casdoor format or is_admin in local format
    return user.roles?.includes('admin') || user.is_admin === true || user.roles === 'admin';
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      const dbHealth = await this.db.healthCheck();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbHealth
      });
    });

    // Get dashboard summary
    this.app.get('/api/dashboard', async (req, res) => {
      try {
        const user = await this.verifyToken(req);

        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const days = parseInt(req.query.days) || 30;
        const userId = parseInt(user.sub);
        const isAdmin = this.isAdmin(user);

        const [summary, byDay, totalDefinitions] = await Promise.all([
          this.db.getDashboardSummary(days, userId, isAdmin),
          this.db.getTestRunsByDay(days, userId, isAdmin),
          this.db.getTotalTestDefinitions(userId, isAdmin)
        ]);

        res.json({
          summary,
          byDay,
          totalDefinitions,
          days
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get test runs
    this.app.get('/api/test-runs', async (req, res) => {
      try {
        const user = await this.verifyToken(req);

        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const limit = parseInt(req.query.limit) || 100;
        const userId = parseInt(user.sub);
        const isAdmin = this.isAdmin(user);

        const runs = await this.db.getRecentTestRuns(limit, userId, isAdmin);
        res.json(runs);
      } catch (error) {
        console.error('Error fetching test runs:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get specific test run details
    this.app.get('/api/test-runs/:runId', async (req, res) => {
      try {
        const runId = parseInt(req.params.runId);
        const testCases = await this.db.getTestCasesForRun(runId);
        res.json(testCases);
      } catch (error) {
        console.error('Error fetching test run details:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get slowest tests
    this.app.get('/api/slowest-tests', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const slowestTests = await this.db.getSlowestTests(limit);
        res.json(slowestTests);
      } catch (error) {
        console.error('Error fetching slowest tests:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get flaky tests
    this.app.get('/api/flaky-tests', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 30;
        const flakyTests = await this.db.getFlakyTests(days);
        res.json(flakyTests);
      } catch (error) {
        console.error('Error fetching flaky tests:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get failure patterns
    this.app.get('/api/failure-patterns', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 10;
        const patterns = await this.db.getFailurePatterns(limit);
        res.json(patterns);
      } catch (error) {
        console.error('Error fetching failure patterns:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Proxy user management requests to test-case-service
    this.app.proxyUserManagement = async (req, res) => {
      try {
        const user = await this.verifyToken(req);

        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = parseInt(user.sub);
        const isAdmin = this.isAdmin(user);

        if (!isAdmin) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        // Forward request to test-case-service
        const targetUrl = `http://test-case-service:8001/api/v1/users${req.url.substring('/api/users'.length)}`;
        const response = await fetch(targetUrl, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization
          },
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error('Error proxying user management request:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };

    // User management endpoints
    this.app.get('/api/users', this.app.proxyUserManagement);
    this.app.get('/api/users/:id', this.app.proxyUserManagement);
    this.app.post('/api/users', this.app.proxyUserManagement);
    this.app.put('/api/users/:id', this.app.proxyUserManagement);
    this.app.delete('/api/users/:id', this.app.proxyUserManagement);
    this.app.post('/api/users/:id/roles', this.app.proxyUserManagement);
    this.app.delete('/api/users/:id/roles/:roleId', this.app.proxyUserManagement);

    // Serve the dashboard HTML
    this.app.get('/', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 30;
        const [summary, byDay] = await Promise.all([
          this.db.getDashboardSummary(days),
          this.db.getTestRunsByDay(days)
        ]);

        const data = {
          summary,
          byDay,
          days
        };

        // Simple HTML response (can be enhanced with templates later)
        res.send(this.generateDashboardHTML(data));
      } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).json({ error: 'Failed to render dashboard' });
      }
    });

    // Serve React frontend for all other routes in production
    if (process.env.NODE_ENV === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(join(process.cwd(), 'frontend/dist/index.html'));
      });
    }

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  generateDashboardHTML(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Tests - Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    .stat-card.passed .value { color: #4caf50; }
    .stat-card.failed .value { color: #f44336; }
    .stat-card.total .value { color: #2196f3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Claude Code Tests Dashboard</h1>
      <p>Real-time test analytics and monitoring</p>
    </div>
    <div class="stats">
      <div class="stat-card total">
        <h3>Total Tests (Last ${data.days} days)</h3>
        <div class="value">${data.summary.total_tests || 0}</div>
      </div>
      <div class="stat-card passed">
        <h3>Passed</h3>
        <div class="value">${data.summary.total_passed || 0}</div>
      </div>
      <div class="stat-card failed">
        <h3>Failed</h3>
        <div class="value">${data.summary.total_failed || 0}</div>
      </div>
      <div class="stat-card total">
        <h3>Success Rate</h3>
        <div class="value">${data.summary.total_tests > 0 ? ((data.summary.total_passed / data.summary.total_tests) * 100).toFixed(1) : 0}%</div>
      </div>
    </div>
    <div class="header">
      <h2>Test Runs by Day</h2>
      <pre>${JSON.stringify(data.byDay, null, 2)}</pre>
    </div>
  </div>
  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>
    `;
  }

  setupWebSocket(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.debug('Received WebSocket message:', data);

          switch (data.type) {
            case 'subscribe':
              ws.send(JSON.stringify({
                type: 'subscribed',
                message: 'Successfully subscribed to updates'
              }));
              break;
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, timestamp: Date.now(), data });
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, () => {
        console.log(`Dashboard service started on port ${this.port}`);
        this.setupWebSocket(server);
        resolve();
      });

      server.on('error', (error) => {
        console.error('Server error:', error);
        reject(error);
      });
    });
  }

  async stop() {
    console.log('Stopping dashboard service');
    if (this.wss) {
      this.wss.close();
    }
    await this.db.close();
  }
}

// Start the service if this is the main module
const service = new DashboardService(parseInt(process.env.PORT) || 8003);
service.start().catch((error) => {
  console.error('Failed to start dashboard service:', error);
  process.exit(1);
});
