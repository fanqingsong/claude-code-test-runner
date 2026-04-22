import { Database } from "bun:sqlite";
import { FlakyTestInfo } from "./query-builder";

export interface FlakyTestWithHistory extends FlakyTestInfo {
  recent_results: Array<{ status: string; timestamp: number }>;
  flakiness_score: number;
}

export class FlakyDetector {
  constructor(private db: Database) {}

  detectFlakyTests(days: number = 30): FlakyTestWithHistory[] {
    const flakyTests = this.getFlakyTestsBase(days);
    const result: FlakyTestWithHistory[] = [];

    for (const test of flakyTests) {
      const recentResults = this.getRecentTestResults(test.test_id, days);
      const flakinessScore = this.calculateFlakinessScore(test.pass_rate, recentResults);

      result.push({
        ...test,
        recent_results: recentResults,
        flakiness_score: flakinessScore,
      });
    }

    return result.sort((a, b) => b.flakiness_score - a.flakiness_score);
  }

  private getFlakyTestsBase(days: number): FlakyTestInfo[] {
    const stmt = this.db.prepare(`
      SELECT
        tc.test_id,
        COUNT(*) as total_runs,
        SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as passes,
        SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as failures,
        CAST(SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as pass_rate
      FROM test_cases tc
      JOIN test_runs tr ON tc.run_id = tr.id
      WHERE tr.start_time >= strftime('%s', 'now', '-' || ? || ' days')
      GROUP BY tc.test_id
      HAVING pass_rate > 0.3 AND pass_rate < 0.7
    `);
    return stmt.all(days) as FlakyTestInfo[];
  }

  private getRecentTestResults(testId: string, days: number): Array<{ status: string; timestamp: number }> {
    const stmt = this.db.prepare(`
      SELECT
        tc.status,
        tr.start_time as timestamp
      FROM test_cases tc
      JOIN test_runs tr ON tc.run_id = tr.id
      WHERE tc.test_id = ?
        AND tr.start_time >= strftime('%s', 'now', '-' || ? || ' days')
      ORDER BY tr.start_time DESC
      LIMIT 10
    `);
    return stmt.all(testId, days) as any;
  }

  private calculateFlakinessScore(passRate: number, recentResults: Array<{ status: string; timestamp: number }>): number {
    const passRateScore = 100 - Math.abs(passRate - 0.5) * 200;

    if (recentResults.length < 2) {
      const clampedPassRateScore = Math.max(0, Math.min(100, passRateScore));
      return clampedPassRateScore;
    }

    const passCount = recentResults.filter((r) => r.status === "passed").length;
    const recentPassRate = passCount / recentResults.length;
    const variancePenalty = Math.abs(passRate - recentPassRate) * 50;

    const result = passRateScore + variancePenalty;
    return Math.max(0, Math.min(100, result));
  }
}