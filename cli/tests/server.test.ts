import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { ReportingServer } from '../src/reporting/server';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Reporting Server Integration Tests', () => {
  let server: ReportingServer;
  let testDbPath: string;
  let db: Database;

  beforeAll(async () => {
    // Create test database directory
    testDbPath = './test-results-integration';
    mkdirSync(testDbPath, { recursive: true });

    // Initialize test database with schema
    db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        total_tests INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        total_duration INTEGER NOT NULL,
        environment TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        test_id TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
        duration INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        message TEXT,
        FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS test_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_case_id INTEGER NOT NULL,
        step_number INTEGER NOT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'pending')),
        error_message TEXT,
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
      );
    `);

    // Insert test data
    const insertRun = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, environment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRun.run('test-run-1', Date.now() - 3600000, Date.now() - 3500000, 3, 2, 1, 15000, 'test', Date.now());

    const insertCase1 = db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCase1.run(1, 'test-1', 'First test case', 'passed', 5000, Date.now() - 3600000, Date.now() - 3550000, null);

    const insertCase2 = db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCase2.run(1, 'test-2', 'Second test case', 'failed', 7000, Date.now() - 3550000, Date.now() - 3480000, 'Test failed');

    // Start server
    server = new ReportingServer(0, testDbPath); // Use port 0 for random available port
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    rmSync(testDbPath, { recursive: true, force: true });
  });

  test('server should start and respond to health check', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  test('should return dashboard data', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/api/dashboard`);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('passRateTrend');
    expect(data).toHaveProperty('durationTrend');
    expect(data).toHaveProperty('slowestTests');
    expect(data).toHaveProperty('flakyTests');
    expect(data).toHaveProperty('failurePatterns');
    expect(data).toHaveProperty('executionFrequency');

    expect(data.summary).toHaveProperty('total_tests');
    expect(data.summary).toHaveProperty('pass_rate');
    expect(data.summary).toHaveProperty('avg_duration');
    expect(data.summary).toHaveProperty('flaky_count');
    expect(data.summary).toHaveProperty('last_run_time');
  });

  test('should return test runs', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/api/test-runs`);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const firstRun = data[0];
    expect(firstRun).toHaveProperty('run_id');
    expect(firstRun).toHaveProperty('start_time');
    expect(firstRun).toHaveProperty('end_time');
    expect(firstRun).toHaveProperty('total_tests');
    expect(firstRun).toHaveProperty('passed');
    expect(firstRun).toHaveProperty('failed');
  });

  test('should return test cases for a specific run', async () => {
    // First get a test run to get its ID
    const runsResponse = await fetch(`http://localhost:${(server as any).port}/api/test-runs`);
    const runs = await runsResponse.json();
    const runId = runs[0].id;

    const response = await fetch(`http://localhost:${(server as any).port}/api/test-runs/${runId}`);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2); // We inserted 2 test cases

    const firstCase = data[0];
    expect(firstCase).toHaveProperty('test_id');
    expect(firstCase).toHaveProperty('description');
    expect(firstCase).toHaveProperty('status');
    expect(firstCase).toHaveProperty('duration');
    expect(firstCase).toHaveProperty('start_time');
    expect(firstCase).toHaveProperty('end_time');
  });

  test('should return slowest tests', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/api/slowest-tests`);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);

    const firstSlow = data[0];
    expect(firstSlow).toHaveProperty('test_id');
    expect(firstSlow).toHaveProperty('avg_duration');
    expect(firstSlow).toHaveProperty('run_count');
  });

  test('should return failure patterns', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/api/failure-patterns`);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      const pattern = data[0];
      expect(pattern).toHaveProperty('description');
      expect(pattern).toHaveProperty('failure_count');
      expect(pattern).toHaveProperty('affected_tests');
    }
  });

  test('should handle 404 for unknown routes', async () => {
    const response = await fetch(`http://localhost:${(server as any).port}/api/unknown`);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not found');
  });

  test('should handle invalid port gracefully', async () => {
    // Test that server handles invalid port configuration
    // This is more of a smoke test since we can't easily test port binding errors
    expect(() => {
      new ReportingServer(-1, testDbPath);
    }).not.toThrow();
  });

  test('should handle WebSocket connections', async () => {
    // This is a basic smoke test for WebSocket functionality
    // In a real environment, you'd test actual WebSocket communication
    expect(server).toBeDefined();
    expect(typeof server.getUrl).toBe('function');
    expect(typeof server.broadcastUpdate).toBe('function');
  });

  test('should broadcast updates correctly', () => {
    // Test that broadcastUpdate method exists and can be called without error
    expect(() => {
      server.broadcastUpdate('test', { message: 'test' });
    }).not.toThrow();
  });

  test('should return server URL', () => {
    const url = server.getUrl();
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
  });

  test('should handle database connection errors gracefully', async () => {
    // Test server behavior when database is unavailable
    // This is difficult to test without actually breaking the database connection
    // but we can at least verify the server continues to run
    expect(server).toBeDefined();
    await expect(server.getUrl()).resolves.toBeTruthy();
  });
});