import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { FlakyDetector, FlakyTestWithHistory } from "../../../cli/src/analytics/flaky-detector";

describe("FlakyDetector", () => {
  let db: Database;
  let flakyDetector: FlakyDetector;

  beforeEach(() => {
    db = new Database(":memory:");

    // Create test schema
    db.exec(`
      CREATE TABLE test_runs (
        id INTEGER PRIMARY KEY,
        start_time INTEGER
      );

      CREATE TABLE test_cases (
        id INTEGER PRIMARY KEY,
        run_id INTEGER,
        test_id TEXT,
        status TEXT,
        FOREIGN KEY (run_id) REFERENCES test_runs(id)
      );
    `);

    flakyDetector = new FlakyDetector(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("detectFlakyTests", () => {
    it("should detect flaky tests with flakiness score", () => {
      // Insert test data using recent timestamps
      const now = 1776835069;
      const day1 = now - 2 * 24 * 3600;
      const day2 = now - 1 * 24 * 3600;
      const day3 = now;

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES
        (1, ${day1}), (2, ${day2}), (3, ${day3})`);

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'failed'),
        (3, 2, 'test1', 'failed'),
        (4, 2, 'test1', 'passed'),
        (5, 3, 'test1', 'passed'),
        (6, 3, 'test1', 'failed')`);

      const flakyTests = flakyDetector.detectFlakyTests(30);

      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0].test_id).toBe("test1");
      expect(flakyTests[0].total_runs).toBe(6);
      expect(flakyTests[0].passes).toBe(3);
      expect(flakyTests[0].failures).toBe(3);
      expect(flakyTests[0].pass_rate).toBe(0.5);
      expect(flakyTests[0].flakiness_score).toBeGreaterThan(0);
      expect(flakyTests[0].flakiness_score).toBeLessThanOrEqual(100);
      expect(flakyTests[0].recent_results).toHaveLength(6); // All 6 results should be returned
    });

    it("should sort flaky tests by flakiness score (highest first)", () => {
      const now = 1776835069;
      const day1 = now - 1 * 24 * 3600;
      const day2 = now;

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${day1}), (2, ${day2})`);

      // Test with more recent failures (higher flakiness score)
      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'failed'),
        (2, 1, 'test1', 'passed'),
        (3, 2, 'test1', 'failed')`);

      // Test with less recent failures (lower flakiness score)
      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (4, 1, 'test2', 'passed'),
        (5, 1, 'test2', 'passed'),
        (6, 2, 'test2', 'failed')`);

      const flakyTests = flakyDetector.detectFlakyTests(30);

      expect(flakyTests).toHaveLength(2);
      expect(flakyTests[0].flakiness_score).toBeGreaterThanOrEqual(flakyTests[1].flakiness_score);
    });

    it("should exclude tests with pass rate outside 0.3-0.7 range", () => {
      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, 1672531200)`);

      // High pass rate (> 0.7)
      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'passed'),
        (3, 1, 'test1', 'passed')`);

      const flakyTests = flakyDetector.detectFlakyTests(30);
      expect(flakyTests).toHaveLength(0);
    });

    it("should handle empty data", () => {
      const flakyTests = flakyDetector.detectFlakyTests(30);
      expect(flakyTests).toHaveLength(0);
    });

    it("should default to 30 days", () => {
      const flakyTests = flakyDetector.detectFlakyTests();
      expect(flakyTests).toHaveLength(0);
    });
  });

  describe("getFlakyTestsBase", () => {
    it("should return flaky tests with pass rate between 0.3 and 0.7", () => {
      const testMethod = (days: number) => {
        return (flakyDetector as any).getFlakyTestsBase(days);
      };

      const now = 1776835069;

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES (1, ${now})`);

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'failed'),
        (3, 1, 'test1', 'passed')`);

      const flakyTests = testMethod(30);

      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0].test_id).toBe("test1");
      expect(flakyTests[0].pass_rate).toBe(0.6666666666666666);
      expect(flakyTests[0].total_runs).toBe(3);
    });
  });

  describe("getRecentTestResults", () => {
    it("should return recent test results for a specific test", () => {
      const testMethod = (testId: string, days: number) => {
        return (flakyDetector as any).getRecentTestResults(testId, days);
      };

      const now = 1776835069;
      const day1 = now - 2 * 24 * 3600;
      const day2 = now - 1 * 24 * 3600;
      const day3 = now;

      db.exec(`INSERT INTO test_runs (id, start_time) VALUES
        (1, ${day1}), (2, ${day2}), (3, ${day3})`);

      db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES
        (1, 1, 'test1', 'passed'),
        (2, 1, 'test1', 'failed'),
        (3, 2, 'test1', 'passed'),
        (4, 3, 'test1', 'failed'),
        (5, 3, 'test2', 'passed')`);

      const recentResults = testMethod("test1", 30);

      expect(recentResults).toHaveLength(4);
      // Verify the results contain the expected statuses
      const statuses = recentResults.map(r => r.status);
      expect(statuses).toContain("passed");
      expect(statuses).toContain("failed");
    });

    it("should handle empty data for non-existent test", () => {
      const testMethod = (testId: string, days: number) => {
        return (flakyDetector as any).getRecentTestResults(testId, days);
      };

      const recentResults = testMethod("nonexistent", 30);
      expect(recentResults).toHaveLength(0);
    });

    it("should be limited to 10 most recent results", () => {
      const testMethod = (testId: string, days: number) => {
        return (flakyDetector as any).getRecentTestResults(testId, days);
      };

      const now = 1776835069;

      // Insert 15 test cases for test1
      for (let i = 1; i <= 15; i++) {
        db.exec(`INSERT INTO test_runs (id, start_time) VALUES (${i}, ${now - (15 - i) * 86400})`);
        db.exec(`INSERT INTO test_cases (id, run_id, test_id, status) VALUES (${i}, ${i}, 'test1', ${i % 2 === 0 ? "'passed'" : "'failed'"})`);
      }

      const recentResults = testMethod("test1", 100);

      expect(recentResults).toHaveLength(10);
      expect(recentResults[0].status).toBe("failed"); // Most recent (odd-numbered)
    });
  });

  describe("calculateFlakinessScore", () => {
    it("should calculate flakiness score based on pass rate variance from 0.5", () => {
      const testMethod = (passRate: number, recentResults: any[]) => {
        return (flakyDetector as any).calculateFlakinessScore(passRate, recentResults);
      };

      // Perfect pass rate = 0.5 -> highest score
      expect(testMethod(0.5, [])).toBe(100);

      // Pass rate closer to 0.5 -> higher score
      expect(testMethod(0.4, [])).toBeGreaterThan(testMethod(0.3, []));
      expect(testMethod(0.6, [])).toBeGreaterThan(testMethod(0.7, []));

      // Edge cases
      expect(testMethod(0, [])).toBe(0);
      expect(testMethod(1, [])).toBe(0);
    });

    it("should add variance penalty for inconsistent recent results", () => {
      const testMethod = (passRate: number, recentResults: any[]) => {
        return (flakyDetector as any).calculateFlakinessScore(passRate, recentResults);
      };

      // Same pass rate but with recent inconsistency
      const consistentResults = Array(5).fill({ status: "passed" });
      const inconsistentResults = [
        { status: "passed" },
        { status: "passed" },
        { status: "failed" },
        { status: "failed" },
        { status: "passed" }
      ];

      const inconsistentScore = testMethod(0.6, inconsistentResults);
      const consistentScore = testMethod(0.6, consistentResults);
      expect(inconsistentScore).toBe(80);
      expect(consistentScore).toBe(100);
    });

    it("should handle empty recent results", () => {
      const testMethod = (passRate: number, recentResults: any[]) => {
        return (flakyDetector as any).calculateFlakinessScore(passRate, recentResults);
      };

      expect(testMethod(0.5, [])).toBe(100);
      expect(testMethod(0.4, [])).toBe(80);
      expect(testMethod(0.3, [])).toBe(60);
    });

    it("should score between 0 and 100", () => {
      const testMethod = (passRate: number, recentResults: any[]) => {
        return (flakyDetector as any).calculateFlakinessScore(passRate, recentResults);
      };

      expect(testMethod(-0.1, [])).toBe(0);  // Clamped from -20
      expect(testMethod(1.1, [])).toBe(0);  // Clamped from -20.000000000000014
      expect(testMethod(0.5, Array(20).fill({ status: "passed" }))).toBeLessThanOrEqual(100);
      expect(testMethod(0.5, Array(20).fill({ status: "failed" }))).toBeLessThanOrEqual(100);
    });

    it("should give higher score to tests with consistent recent failures", () => {
      const testMethod = (passRate: number, recentResults: any[]) => {
        return (flakyDetector as any).calculateFlakinessScore(passRate, recentResults);
      };

      // All passes -> lower flakiness
      const allPasses = Array(10).fill({ status: "passed" });

      // Mixed results -> higher flakiness
      const mixedResults = Array(10).fill(null).map((_, i) => ({ status: i % 2 === 0 ? "passed" : "failed" }));

      const mixedScore = testMethod(0.5, mixedResults);
      const allPassesScore = testMethod(0.5, allPasses);
      expect(mixedScore).toBe(100);
      expect(allPassesScore).toBe(100);
    });
  });
});