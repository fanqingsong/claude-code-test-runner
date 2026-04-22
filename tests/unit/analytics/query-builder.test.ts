import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { QueryBuilder, PassRateTrend, TestDuration, FlakyTestInfo, FailurePattern } from "../../../cli/src/analytics/query-builder";

describe("QueryBuilder", () => {
  let db: Database;
  let queryBuilder: QueryBuilder;

  beforeEach(() => {
    db = new Database(":memory:");

    // Create test schema
    db.exec(`
      CREATE TABLE test_runs (
        id INTEGER PRIMARY KEY,
        start_time INTEGER,
        passed INTEGER,
        total_tests INTEGER
      );

      CREATE TABLE test_cases (
        id INTEGER PRIMARY KEY,
        run_id INTEGER,
        test_id TEXT,
        status TEXT,
        duration REAL,
        start_time INTEGER,
        FOREIGN KEY (run_id) REFERENCES test_runs(id)
      );

      CREATE TABLE test_steps (
        id INTEGER PRIMARY KEY,
        test_case_id INTEGER,
        description TEXT,
        status TEXT,
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
      );
    `);

    queryBuilder = new QueryBuilder(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("getPassRateTrends", () => {
    it("should return pass rate trends for the specified days", () => {
      // Insert test data using recent timestamps
      const now = 1776835069; // Current timestamp (April 2026)
      const day1 = now - 2 * 24 * 3600; // 2 days ago
      const day2 = now - 1 * 24 * 3600; // 1 day ago
      const day3 = now; // Today

      db.exec(`INSERT INTO test_runs (id, start_time, passed, total_tests) VALUES
        (1, ${day1}, 5, 10), (2, ${day2}, 8, 10), (3, ${day3}, 6, 10)`);

      const trends = queryBuilder.getPassRateTrends(30);

      expect(trends).toHaveLength(3);
      expect(trends[0].pass_rate).toBe(50.0);
      expect(trends[1].pass_rate).toBe(80.0);
      expect(trends[2].pass_rate).toBe(60.0);
    });

    it("should handle empty data", () => {
      const trends = queryBuilder.getPassRateTrends(30);
      expect(trends).toHaveLength(0);
    });

    it("should default to 30 days", () => {
      const trends = queryBuilder.getPassRateTrends();
      expect(trends).toHaveLength(0);
    });
  });

  describe("getSlowestTests", () => {
    it("should return slowest tests ordered by average duration", () => {
      const now = 1776835069;
      const day1 = now - 1 * 24 * 3600;
      const day2 = now;

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status, duration) VALUES
        (1, 1, 'test1', 'passed', 10.5),
        (2, 1, 'test2', 'passed', 15.0),
        (3, 2, 'test1', 'passed', 12.0),
        (4, 2, 'test2', 'passed', 18.0)`);

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${day1}), (2, ${day2})`);

      const slowestTests = queryBuilder.getSlowestTests(2);

      expect(slowestTests).toHaveLength(2);
      expect(slowestTests[0].test_id).toBe("test2");
      expect(slowestTests[0].avg_duration).toBe(16.5);
      expect(slowestTests[1].test_id).toBe("test1");
      expect(slowestTests[1].avg_duration).toBe(11.25);
    });

    it("should handle empty data", () => {
      const slowestTests = queryBuilder.getSlowestTests(10);
      expect(slowestTests).toHaveLength(0);
    });
  });

  describe("getFlakyTests", () => {
    it("should return flaky tests with pass rate between 0.3 and 0.7", () => {
      const now = 1776835069;

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'failed'),
        (3, 1, 'test2', 'passed'),
        (4, 1, 'test2', 'passed')`);

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${now})`);

      const flakyTests = queryBuilder.getFlakyTests(30);

      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0].test_id).toBe("test1");
      expect(flakyTests[0].pass_rate).toBe(0.5);
      expect(flakyTests[0].total_runs).toBe(2);
      expect(flakyTests[0].passes).toBe(1);
      expect(flakyTests[0].failures).toBe(1);
    });

    it("should exclude tests with pass rate outside 0.3-0.7 range", () => {
      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'passed')`);

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, 1672531200)`);

      const flakyTests = queryBuilder.getFlakyTests(30);
      expect(flakyTests).toHaveLength(0);
    });

    it("should handle empty data", () => {
      const flakyTests = queryBuilder.getFlakyTests(30);
      expect(flakyTests).toHaveLength(0);
    });
  });

  describe("getFailurePatterns", () => {
    it("should return failure patterns ordered by count", () => {
      db.exec(`INSERT INTO test_cases (id, test_id) VALUES (1, 'test1'), (2, 'test2')`);

      db.exec(`INSERT INTO test_steps (id, test_case_id, description, status) VALUES
        (1, 1, 'Connection timeout', 'failed'),
        (2, 1, 'Connection timeout', 'failed'),
        (3, 2, 'Assertion failed', 'failed')`);

      const failurePatterns = queryBuilder.getFailurePatterns(10);

      expect(failurePatterns).toHaveLength(2);
      expect(failurePatterns[0].description).toBe("Connection timeout");
      expect(failurePatterns[0].failure_count).toBe(2);
      expect(failurePatterns[0].affected_tests).toBe(1);
      expect(failurePatterns[1].description).toBe("Assertion failed");
      expect(failurePatterns[1].failure_count).toBe(1);
      expect(failurePatterns[1].affected_tests).toBe(1);
    });

    it("should handle empty data", () => {
      const failurePatterns = queryBuilder.getFailurePatterns(10);
      expect(failurePatterns).toHaveLength(0);
    });
  });

  describe("getDurationTrends", () => {
    it("should return duration trends grouped by date and test", () => {
      const now = 1776835069;
      const day1 = now - 1 * 24 * 3600;
      const day2 = now;

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status, duration, start_time) VALUES
        (1, 1, 'test1', 'passed', 10.0, ${day1}),
        (2, 1, 'test1', 'passed', 15.0, ${day1}),
        (3, 1, 'test2', 'passed', 12.0, ${day1})`);

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${day1})`);

      const durationTrends = queryBuilder.getDurationTrends(30);

      expect(durationTrends).toHaveLength(2);
      expect(durationTrends[0].test_id).toBe("test1");
      expect(durationTrends[0].avg_duration).toBe(12.5);
      expect(durationTrends[1].test_id).toBe("test2");
      expect(durationTrends[1].avg_duration).toBe(12.0);
    });

    it("should handle empty data", () => {
      const durationTrends = queryBuilder.getDurationTrends(30);
      expect(durationTrends).toHaveLength(0);
    });
  });

  describe("getExecutionFrequency", () => {
    it("should return execution frequency grouped by test and date", () => {
      const now = 1776835069;
      const day1 = now - 1 * 24 * 3600;
      const day2 = now;

      db.exec(`INSERT INTO test_cases (id, run_id, test_id) VALUES
        (1, 1, 'test1'),
        (2, 1, 'test1'),
        (3, 2, 'test2')`);

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${day1}), (2, ${day2})`);

      const executionFrequency = queryBuilder.getExecutionFrequency(30);

      expect(executionFrequency).toHaveLength(2);
      expect(executionFrequency[0].test_id).toBe("test1");
      expect(executionFrequency[0].run_count).toBe(2);
      expect(executionFrequency[1].test_id).toBe("test2");
      expect(executionFrequency[1].run_count).toBe(1);
    });

    it("should handle empty data", () => {
      const executionFrequency = queryBuilder.getExecutionFrequency(30);
      expect(executionFrequency).toHaveLength(0);
    });
  });
});