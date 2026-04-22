import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { getDatabasePath } from "../../../src/db/migrations";
import type { TestRun, TestCase, TestStep } from "../../../src/db/schema";

const TEST_DB_PATH = "/tmp/test-manager.db";

describe("DatabaseManager", () => {
  let manager: DatabaseManager;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Create test results directory
    const testResultsDir = "/tmp/.analytics";
    if (!existsSync(testResultsDir)) {
      require("fs").mkdirSync(testResultsDir, { recursive: true });
    }
    manager = new DatabaseManager("/tmp");
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should insert and retrieve test runs", () => {
    const testRun: TestRun = {
      run_id: "test-123",
      start_time: 1000,
      end_time: 2000,
      total_tests: 2,
      passed: 1,
      failed: 1,
      total_duration: 1000,
      created_at: 1000,
    };

    manager.insertTestRun(testRun);
    const runs = manager.getRecentTestRuns(10);

    expect(runs).toHaveLength(1);
    expect(runs[0].run_id).toBe("test-123");
  });

  it("should insert and retrieve test cases", () => {
    const testRun: TestRun = {
      run_id: "test-123",
      start_time: 1000,
      end_time: 2000,
      total_tests: 1,
      passed: 1,
      failed: 0,
      total_duration: 1000,
      created_at: 1000,
    };

    const runId = manager.insertTestRun(testRun);

    const testCase: TestCase = {
      run_id: runId,
      test_id: "login-test",
      description: "Test login",
      status: "passed",
      duration: 500,
      start_time: 1000,
      end_time: 1500,
    };

    manager.insertTestCase(testCase);
    const cases = manager.getTestCasesForRun(runId);

    expect(cases).toHaveLength(1);
    expect(cases[0].test_id).toBe("login-test");
  });

  it("should insert and retrieve test steps", () => {
    const testRun: TestRun = {
      run_id: "test-123",
      start_time: 1000,
      end_time: 2000,
      total_tests: 1,
      passed: 1,
      failed: 0,
      total_duration: 1000,
      created_at: 1000,
    };

    const runId = manager.insertTestRun(testRun);

    const testCase: TestCase = {
      run_id: runId,
      test_id: "login-test",
      description: "Test login",
      status: "passed",
      duration: 500,
      start_time: 1000,
      end_time: 1500,
    };

    const testCaseId = manager.insertTestCase(testCase);

    const testStep: TestStep = {
      test_case_id: testCaseId,
      step_number: 1,
      description: "Navigate to login page",
      status: "passed",
    };

    const stepId = manager.insertTestStep(testStep);
    expect(stepId).toBeGreaterThan(0);
  });
});