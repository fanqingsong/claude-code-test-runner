import express from 'express';
import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import path from 'path';
import { Database } from 'bun:sqlite';
import { DatabaseManager } from '../db/manager';
import { DataProcessor } from './generators/data-processor';
import { QueryBuilder } from '../analytics/query-builder';
import { logger } from '../utils/logger';

export interface TestRunResult {
  id: number;
  run_id: string;
  start_time: number;
  end_time: number;
  total_tests: number;
  passed: number;
  failed: number;
  environment?: string;
}

export interface TestResult {
  id: number;
  test_id: string;
  description: string;
  status: 'passed' | 'failed';
  duration: number;
  start_time: number;
  end_time: number;
  steps?: Array<{
    step_number: number;
    description: string;
    status: 'passed' | 'failed' | 'pending';
    error_message?: string;
  }>;
}

export class ReportingServer {
  private app: express.Application;
  private server: HttpServer;
  private wss: WebSocketServer;
  private dbManager: DatabaseManager;
  private dataProcessor: DataProcessor;

  constructor(private port: number = 3000, private dbPath: string = './results') {
    this.app = express();
    this.server = new HttpServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.dbManager = new DatabaseManager(this.dbPath);
    this.dataProcessor = new DataProcessor(this.dbManager.getConnection());

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'public')));
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get dashboard data
    this.app.get('/api/dashboard', (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const data = this.dataProcessor.processDashboardData(days);
        res.json(data);
      } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get test runs
    this.app.get('/api/test-runs', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const queryBuilder = new QueryBuilder(this.dbManager.getConnection());
        const runs = queryBuilder.getRecentTestRuns(limit);
        res.json(runs);
      } catch (error) {
        logger.error('Error fetching test runs:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get specific test run details
    this.app.get('/api/test-runs/:runId', (req, res) => {
      try {
        const runId = parseInt(req.params.runId);
        const queryBuilder = new QueryBuilder(this.dbManager.getConnection());
        const testCases = queryBuilder.getTestCasesForRun(runId);
        res.json(testCases);
      } catch (error) {
        logger.error('Error fetching test run details:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get slowest tests
    this.app.get('/api/slowest-tests', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const queryBuilder = new QueryBuilder(this.dbManager.getConnection());
        const slowestTests = queryBuilder.getSlowestTests(limit);
        res.json(slowestTests);
      } catch (error) {
        logger.error('Error fetching slowest tests:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get flaky tests
    this.app.get('/api/flaky-tests', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const { FlakyDetector } = await import('../analytics/flaky-detector');
        const flakyDetector = new FlakyDetector(this.dbManager.getConnection());
        const flakyTests = flakyDetector.detectFlakyTests(days);
        res.json(flakyTests);
      } catch (error) {
        logger.error('Error fetching flaky tests:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get failure patterns
    this.app.get('/api/failure-patterns', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const queryBuilder = new QueryBuilder(this.dbManager.getConnection());
        const patterns = queryBuilder.getFailurePatterns(limit);
        res.json(patterns);
      } catch (error) {
        logger.error('Error fetching failure patterns:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Serve the dashboard HTML
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'src/reporting/templates/dashboard.ejs'));
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      logger.info('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('Received WebSocket message:', data);

          // Handle different message types
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
          logger.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });
  }

  // Broadcast real-time updates to all connected clients
  public broadcastUpdate(type: string, data: any): void {
    const message = JSON.stringify({ type, timestamp: Date.now(), data });
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  // Start the server
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        logger.info(`Reporting server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        reject(error);
      });
    });
  }

  // Stop the server
  public stop(): void {
    logger.info('Stopping reporting server');
    this.wss.close();
    this.server.close();
    // Database is managed by DatabaseManager, no need to close
  }

  // Get server URL
  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}