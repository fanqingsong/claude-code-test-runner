// tests/unit/db/schema.test.ts

import { describe, it, expect } from "bun:test";
import { CREATE_TABLES_SQL, TestRun, TestCase, TestStep } from "../../../src/db/schema";

describe("Database Schema", () => {
  it("should define valid SQL for table creation", () => {
    expect(CREATE_TABLES_SQL).toContain("CREATE TABLE IF NOT EXISTS test_runs");
    expect(CREATE_TABLES_SQL).toContain("CREATE TABLE IF NOT EXISTS test_cases");
    expect(CREATE_TABLES_SQL).toContain("CREATE TABLE IF NOT EXISTS test_steps");
  });

  it("should create indexes for performance", () => {
    expect(CREATE_TABLES_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_test_runs_start_time");
    expect(CREATE_TABLES_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_test_cases_test_id_status");
  });

  it("should have correct TypeScript types", () => {
    const testRun: TestRun = {
      run_id: "123",
      start_time: Date.now(),
      end_time: Date.now() + 1000,
      total_tests: 1,
      passed: 1,
      failed: 0,
      total_duration: 1000,
      created_at: Date.now(),
    };
    expect(testRun.run_id).toBe("123");
  });
});