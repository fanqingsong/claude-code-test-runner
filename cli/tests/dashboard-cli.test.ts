import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { Database } from 'bun:sqlite';
import { join } from 'path';

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
    // Create a simple SQLite database with test data
    const db = new Database(testDbPath);
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
        step_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'pending')),
        error_message TEXT,
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
      );
    `);

    // Insert test data
    db.exec(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, environment, created_at)
      VALUES ('test-run-1', ${Date.now() - 3600000}, ${Date.now() - 3500000}, 3, 2, 1, 15000, 'test', ${Date.now()});
    `);

    db.exec(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (1, 'test-1', 'First test case', 'passed', 5000, ${Date.now() - 3600000}, ${Date.now() - 3550000}, null);
    `);

    db.exec(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (1, 'test-2', 'Second test case', 'failed', 7000, ${Date.now() - 3550000}, ${Date.now() - 3480000}, 'Test failed');
    `);

    db.exec(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (1, 'test-3', 'Third test case', 'passed', 3000, ${Date.now() - 3480000}, ${Date.now() - 3450000}, null);
    `);

    db.exec(`
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (1, 1, 'Step 1', 'passed', null);
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (1, 2, 'Step 2', 'passed', null);
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (2, 1, 'Step 1', 'passed', null);
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (2, 2, 'Step 2', 'failed', 'Step failed');
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (3, 1, 'Step 1', 'passed', null);
    `);

    db.close();
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