import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { ReportingServer } from '../src/reporting/server';
import { DatabaseManager } from '../src/db/manager';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Reporting Server Integration Tests', () => {
  let server: ReportingServer;
  let testDbPath: string;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Create test database directory
    testDbPath = './test-results-integration';
    mkdirSync(testDbPath, { recursive: true });

    // Initialize test database with DatabaseManager
    dbManager = new DatabaseManager(testDbPath);
    const db = dbManager.getConnection();

    // Insert test data
    const runResult = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, environment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-run-1", Date.now() - 1000, Date.now(), 10, 8, 2, 5000, "test", Date.now());

    const runId = runResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-1", "Test 1", "passed", 500, Date.now() - 1000, Date.now());

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-2", "Test 2", "failed", 1000, Date.now() - 900, Date.now());

    // Start server
    server = new ReportingServer(0, testDbPath); // Use port 0 for random available port
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    rmSync(testDbPath, { recursive: true, force: true });
  });

  test('should start server successfully', () => {
    expect(server).toBeDefined();
    expect(server['server']).toBeDefined();
  });

  test('should provide dashboard data via API', async () => {
    const response = await fetch(`http://localhost:${server.getPort()}/api/dashboard`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('passRateTrend');
    expect(data).toHaveProperty('durationTrend');
    expect(data.summary).toHaveProperty('total_tests');
    expect(data.summary).toHaveProperty('pass_rate');
    expect(data.summary).toHaveProperty('avg_duration');
    expect(data.summary).toHaveProperty('flaky_count');
  });

  test('should provide test runs via API', async () => {
    const response = await fetch(`http://localhost:${server.getPort()}/api/test-runs`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const run = data[0];
    expect(run).toHaveProperty('run_id');
    expect(run).toHaveProperty('start_time');
    expect(run).toHaveProperty('end_time');
    expect(run).toHaveProperty('total_tests');
    expect(run).toHaveProperty('passed');
    expect(run).toHaveProperty('failed');
  });

  test('should provide test cases via API', async () => {
    const response = await fetch(`http://localhost:${server.getPort()}/api/test-cases`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const testCase = data[0];
    expect(testCase).toHaveProperty('test_id');
    expect(testCase).toHaveProperty('description');
    expect(testCase).toHaveProperty('status');
    expect(testCase).toHaveProperty('duration');
  });

  test('should handle invalid API endpoints', async () => {
    const response = await fetch(`http://localhost:${server.getPort()}/api/invalid`);
    expect(response.status).toBe(404);
  });

  test('should serve dashboard HTML', async () => {
    const response = await fetch(`http://localhost:${server.getPort()}/`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Test Analytics Dashboard');
    expect(html).toContain('chart.js');
  });
});