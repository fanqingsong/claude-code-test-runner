import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { DataProcessor } from "../../../src/reporting/generators/data-processor";
import { getDatabasePath } from "../../../src/db/migrations";

const TEST_RESULTS_DIR = "/tmp/.analytics-data-processor-test";
const TEST_DB_PATH = getDatabasePath(TEST_RESULTS_DIR);

describe("DataProcessor", () => {
  let dbManager: DatabaseManager;
  let processor: DataProcessor;

  function setupTestData() {
    const db = dbManager.getConnection();
    const now = Date.now();

    // Insert test run
    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", now - 1000, now, 2, 1, 1, 1000, now).lastInsertRowid as number;

    // Insert test cases
    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, now - 1000, now - 500);

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-b", "Test B", "failed", 1000, now - 500, now);

    // Insert test step
    db.prepare(`
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(2, 1, "Click login", "failed", "Element not found");
  }

  beforeEach(() => {
    // Clean up database file if it exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Create test results directory
    if (!existsSync(TEST_RESULTS_DIR)) {
      mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    }

    dbManager = new DatabaseManager(TEST_RESULTS_DIR);
    setupTestData();
    processor = new DataProcessor(dbManager.getConnection());
  });

  afterEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_RESULTS_DIR)) {
      require("fs").rmdirSync(TEST_RESULTS_DIR, { recursive: true });
    }
  });

  it("should process dashboard data", () => {
    const data = processor.processDashboardData(30);

    expect(data.summary.total_tests).toBe(2);
    expect(data.summary.pass_rate).toBe(50);
    expect(data.passRateTrend).toBeDefined();
    expect(data.slowestTests).toBeDefined();
  });

  it("should calculate summary statistics", () => {
    const data = processor.processDashboardData(30);

    expect(data.summary.total_tests).toBe(2);
    expect(data.summary.avg_duration).toBe(750); // (500 + 1000) / 2
    expect(data.summary.flaky_count).toBeDefined();
  });

  it("should have correct data structure", () => {
    const data = processor.processDashboardData(30);

    expect(data.summary).toHaveProperty("total_tests");
    expect(data.summary).toHaveProperty("pass_rate");
    expect(data.summary).toHaveProperty("avg_duration");
    expect(data.summary).toHaveProperty("flaky_count");
    expect(data.summary).toHaveProperty("last_run_time");

    expect(data.passRateTrend).toBeInstanceOf(Array);
    expect(data.durationTrend).toBeInstanceOf(Array);
    expect(data.slowestTests).toBeInstanceOf(Array);
    expect(data.flakyTests).toBeInstanceOf(Array);
    expect(data.failurePatterns).toBeInstanceOf(Array);
    expect(data.executionFrequency).toBeInstanceOf(Array);
  });
});