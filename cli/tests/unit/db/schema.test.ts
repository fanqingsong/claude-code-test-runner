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
    expect(CREATE_TABLES_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_test_steps_test_case_id");
    expect(CREATE_TABLES_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_test_steps_status");
  });

  it("should include CASCADE delete for foreign keys", () => {
    expect(CREATE_TABLES_SQL).toContain("ON DELETE CASCADE");
    // Should have exactly 2 CASCADE statements
    const cascadeMatches = CREATE_TABLES_SQL.match(/ON DELETE CASCADE/g);
    expect(cascadeMatches).toHaveLength(2);
  });

  it("should include CHECK constraints for status fields", () => {
    expect(CREATE_TABLES_SQL).toContain("CHECK (status IN ('passed', 'failed'))");
    expect(CREATE_TABLES_SQL).toContain("CHECK (status IN ('passed', 'failed', 'pending'))");
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

  it("should enforce TestRun interface constraints", () => {
    // Ensure required fields are present and have correct types
    const createTableMatch = CREATE_TABLES_SQL.match(/CREATE TABLE IF NOT EXISTS test_runs \(([\s\S]*?)\);/);
    expect(createTableMatch).toBeTruthy();

    const tableDefinition = createTableMatch![1];
    expect(tableDefinition).toContain("run_id TEXT UNIQUE NOT NULL");
    expect(tableDefinition).toContain("start_time INTEGER NOT NULL");
    expect(tableDefinition).toContain("end_time INTEGER NOT NULL");
    expect(tableDefinition).toContain("total_tests INTEGER NOT NULL");
    expect(tableDefinition).toContain("passed INTEGER NOT NULL");
    expect(tableDefinition).toContain("failed INTEGER NOT NULL");
    expect(tableDefinition).toContain("total_duration INTEGER NOT NULL");
  });

  it("should enforce TestCase interface constraints", () => {
    const createTableMatch = CREATE_TABLES_SQL.match(/CREATE TABLE IF NOT EXISTS test_cases \(([\s\S]*?)\);/);
    expect(createTableMatch).toBeTruthy();

    const tableDefinition = createTableMatch![1];
    expect(tableDefinition).toContain("run_id INTEGER NOT NULL");
    expect(tableDefinition).toContain("test_id TEXT NOT NULL");
    expect(tableDefinition).toContain("status TEXT NOT NULL");
  });

  it("should enforce TestStep interface constraints", () => {
    const createTableMatch = CREATE_TABLES_SQL.match(/CREATE TABLE IF NOT EXISTS test_steps \(([\s\S]*?)\);/);
    expect(createTableMatch).toBeTruthy();

    const tableDefinition = createTableMatch![1];
    expect(tableDefinition).toContain("test_case_id INTEGER NOT NULL");
    expect(tableDefinition).toContain("step_number INTEGER NOT NULL");
    expect(tableDefinition).toContain("description TEXT NOT NULL");
    expect(tableDefinition).toContain("status TEXT NOT NULL");
  });
});