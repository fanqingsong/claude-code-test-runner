import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { runMigrations, getDatabasePath } from "./migrations";
import type { TestRun, TestCase, TestStep } from "./schema";

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(resultsPath: string) {
    this.dbPath = getDatabasePath(resultsPath);
    this.initialize();
  }

  private initialize(): void {
    if (!existsSync(this.dbPath)) {
      runMigrations(this.dbPath);
    }

    this.db = new Database(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  
  // Insert test run
  insertTestRun(run: TestRun): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, environment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      run.run_id,
      run.start_time,
      run.end_time,
      run.total_tests,
      run.passed,
      run.failed,
      run.total_duration,
      run.environment || null,
      run.created_at
    );

    return info.lastInsertRowid as number;
  }

  // Insert test case
  insertTestCase(testCase: TestCase): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      testCase.run_id,
      testCase.test_id,
      testCase.description,
      testCase.status,
      testCase.duration,
      testCase.start_time,
      testCase.end_time,
      testCase.message || null
    );

    return info.lastInsertRowid as number;
  }

  // Insert test step
  insertTestStep(step: TestStep): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      step.test_case_id,
      step.step_number,
      step.description,
      step.status,
      step.error_message || null
    );

    return info.lastInsertRowid as number;
  }

  // Get recent test runs
  getRecentTestRuns(limit: number = 100): TestRun[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      SELECT * FROM test_runs
      ORDER BY start_time DESC
      LIMIT ?
    `);

    return stmt.all(limit) as TestRun[];
  }

  // Get test cases for a run
  getTestCasesForRun(runId: number): TestCase[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      SELECT * FROM test_cases
      WHERE run_id = ?
      ORDER BY start_time
    `);

    return stmt.all(runId) as TestCase[];
  }

  // Get database connection (for advanced queries)
  getConnection(): Database {
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }
}