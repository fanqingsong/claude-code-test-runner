import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { DatabaseManager } from '../src/db/manager';

describe('Dashboard CLI Integration Tests', () => {
  let testDbPath: string;
  let outputDir: string;

  beforeAll(() => {
    // Create test directories
    testDbPath = './test-results-cli';
    outputDir = './test-dashboard-output';
    mkdirSync(testDbPath, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // Create test database with some data
    createTestDatabase();
  });

  afterAll(() => {
    rmSync(testDbPath, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up output directory before each test
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
    mkdirSync(outputDir, { recursive: true });
  });

  function createTestDatabase() {
    // Use DatabaseManager to create test database
    const dbManager = new DatabaseManager(testDbPath);
    const db = dbManager.getConnection();

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
  }

  test('should initialize database successfully', () => {
    try {
      execSync(`bun run src/index.ts init --db-path ${testDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      expect(true).toBe(true); // If we reach here, the command succeeded
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true); // Test should fail if command fails
    }
  });

  test('should show database statistics', () => {
    try {
      const output = execSync(`bun run src/index.ts stats --db-path ${testDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      const outputString = output.toString();

      expect(outputString).toContain('Database Statistics:');
      expect(outputString).toContain('Test Runs:');
      expect(outputString).toContain('Test Cases:');
      expect(outputString).toContain('Test Steps:');
      expect(outputString).toContain('Pass Rate:');
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    }
  });

  test('should generate static dashboard', () => {
    try {
      execSync(`bun run src/index.ts generate --output ${outputDir} --db-path ${testDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      // Check if files were created
      const indexHtml = join(outputDir, 'index.html');
      const styleCss = join(outputDir, 'assets', 'style.css');
      const dashboardJs = join(outputDir, 'assets', 'dashboard.js');

      expect(existsSync(indexHtml)).toBe(true);
      expect(existsSync(styleCss)).toBe(true);
      expect(existsSync(dashboardJs)).toBe(true);

      // Check HTML content
      const htmlContent = readFileSync(indexHtml, 'utf-8');
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('Test Results Dashboard');
      expect(htmlContent).toContain('Chart.js');
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    }
  });

  test('should generate static dashboard with custom days parameter', () => {
    try {
      execSync(`bun run src/index.ts generate --output ${outputDir} --db-path ${testDbPath} --days 7`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      const indexHtml = join(outputDir, 'index.html');
      expect(existsSync(indexHtml)).toBe(true);

      const htmlContent = readFileSync(indexHtml, 'utf-8');
      expect(htmlContent).toContain('Test Results Dashboard');
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    }
  });

  test('should cleanup database', () => {
    try {
      execSync(`bun run src/index.ts cleanup --db-path ${testDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      expect(true).toBe(true);
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    }
  });

  test('should handle invalid database path gracefully', () => {
    try {
      execSync(`bun run src/index.ts stats --db-path ./nonexistent-path`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      expect(false).toBe(true); // Should fail
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.toString()).toContain('Error showing database stats');
    }
  });

  test('should handle missing arguments gracefully', () => {
    try {
      execSync(`bun run src/index.ts generate`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      expect(false).toBe(true); // Should fail
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.toString()).toContain('error');
    }
  });

  test('should handle database initialization on non-existent database', () => {
    const newDbPath = './test-new-db';
    mkdirSync(newDbPath, { recursive: true });

    try {
      execSync(`bun run src/index.ts init --db-path ${newDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      // Check if database was created
      const db = new Database(newDbPath);
      const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_runs'").get();
      expect(result).toBeDefined();
      db.close();
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    } finally {
      rmSync(newDbPath, { recursive: true, force: true });
    }
  });

  test('should generate dashboard with custom output path', () => {
    const customOutput = join(outputDir, 'custom-dashboard');
    mkdirSync(customOutput, { recursive: true });

    try {
      execSync(`bun run src/index.ts generate --output ${customOutput} --db-path ${testDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      const indexHtml = join(customOutput, 'index.html');
      expect(existsSync(indexHtml)).toBe(true);

      const htmlContent = readFileSync(indexHtml, 'utf-8');
      expect(htmlContent).toContain('Test Results Dashboard');
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    } finally {
      rmSync(customOutput, { recursive: true, force: true });
    }
  });

  test('should handle cleanup on empty database', () => {
    const emptyDbPath = './test-empty-db';
    mkdirSync(emptyDbPath, { recursive: true });

    try {
      execSync(`bun run src/index.ts init --db-path ${emptyDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      execSync(`bun run src/index.ts cleanup --db-path ${emptyDbPath}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      expect(true).toBe(true); // If we reach here, cleanup succeeded
    } catch (error) {
      console.error('Command failed:', error);
      expect(false).toBe(true);
    } finally {
      rmSync(emptyDbPath, { recursive: true, force: true });
    }
  });
});