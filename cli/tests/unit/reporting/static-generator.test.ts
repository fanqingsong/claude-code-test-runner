import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync, readFileSync, mkdirSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { StaticGenerator } from "../../../src/reporting/generators/static-generator";
import { getDatabasePath } from "../../../src/db/migrations";

const TEST_RESULTS_DIR = "/tmp/.analytics-static-generator-test";
const TEST_DB_PATH = getDatabasePath(TEST_RESULTS_DIR);
const OUTPUT_PATH = "/tmp/test-dashboard.html";

describe("StaticGenerator", () => {
  let dbManager: DatabaseManager;
  let generator: StaticGenerator;

  function setupTestData() {
    const db = dbManager.getConnection();
    const now = Date.now();

    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", now - 1000, now, 1, 1, 0, 1000, now).lastInsertRowid as number;

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, now - 1000, now);
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(OUTPUT_PATH)) {
      unlinkSync(OUTPUT_PATH);
    }

    // Create test results directory
    if (!existsSync(TEST_RESULTS_DIR)) {
      mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    }

    dbManager = new DatabaseManager(TEST_RESULTS_DIR);
    setupTestData();
    generator = new StaticGenerator(dbManager);
  });

  afterEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(OUTPUT_PATH)) {
      unlinkSync(OUTPUT_PATH);
    }
    if (existsSync(TEST_RESULTS_DIR)) {
      require("fs").rmdirSync(TEST_RESULTS_DIR, { recursive: true });
    }
  });

  it("should generate HTML dashboard", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    expect(existsSync(OUTPUT_PATH)).toBe(true);
  });

  it("should include chart data in HTML", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    const html = readFileSync(OUTPUT_PATH, "utf-8");
    expect(html).toContain("const data =");
    expect(html).toContain("passRateTrend");
    expect(html).toContain("chart.js");
  });

  it("should generate file under 500KB", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    const stats = require("fs").statSync(OUTPUT_PATH);
    const sizeKB = stats.size / 1024;
    expect(sizeKB).toBeLessThan(500);
  });

  it("should handle custom days parameter", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 7 });

    const html = readFileSync(OUTPUT_PATH, "utf-8");
    expect(html).toContain("const data =");
  });
});