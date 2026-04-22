import { Database } from "bun:sqlite";
import { QueryBuilder } from "../../analytics/query-builder";
import { FlakyDetector } from "../../analytics/flaky-detector";

export interface ChartData {
  summary: {
    total_tests: number;
    pass_rate: number;
    avg_duration: number;
    flaky_count: number;
    last_run_time: number;
  };
  passRateTrend: Array<{ date: string; pass_rate: number }>;
  durationTrend: Array<{ date: string; test_id: string; avg_duration: number }>;
  slowestTests: Array<{ test_id: string; avg_duration: number; run_count: number }>;
  flakyTests: Array<{
    test_id: string;
    pass_rate: number;
    flakiness_score: number;
    recent_results: Array<{ status: string; timestamp: number }>;
  }>;
  failurePatterns: Array<{ description: string; failure_count: number; affected_tests: number }>;
  executionFrequency: Array<{ test_id: string; date: string; run_count: number }>;
}

export class DataProcessor {
  private queryBuilder: QueryBuilder;
  private flakyDetector: FlakyDetector;

  constructor(db: Database) {
    this.queryBuilder = new QueryBuilder(db);
    this.flakyDetector = new FlakyDetector(db);
  }

  processDashboardData(days: number = 30): ChartData {
    const summary = this.getSummary();
    const passRateTrend = this.queryBuilder.getPassRateTrends(days);
    const durationTrend = this.queryBuilder.getDurationTrends(days);
    const slowestTests = this.queryBuilder.getSlowestTests(20);
    const flakyTests = this.flakyDetector.detectFlakyTests(days);
    const failurePatterns = this.queryBuilder.getFailurePatterns(10);
    const executionFrequency = this.queryBuilder.getExecutionFrequency(days);

    return {
      summary,
      passRateTrend,
      durationTrend,
      slowestTests,
      flakyTests,
      failurePatterns,
      executionFrequency,
    };
  }

  private getSummary(): ChartData["summary"] {
    const db = this.queryBuilder.getConnection();
    const totalTests = db.prepare("SELECT COUNT(*) as count FROM test_cases").get() as { count: number };
    const passedTests = db.prepare("SELECT COUNT(*) as count FROM test_cases WHERE status = 'passed'").get() as { count: number };
    const avgDuration = db.prepare("SELECT AVG(duration) as avg FROM test_cases").get() as { avg: number };
    const lastRun = db.prepare("SELECT MAX(start_time) as last_run FROM test_runs").get() as { last_run: number | null };

    return {
      total_tests: totalTests.count,
      pass_rate: totalTests.count > 0 ? (passedTests.count / totalTests.count) * 100 : 0,
      avg_duration: avgDuration.avg || 0,
      flaky_count: this.flakyDetector.detectFlakyTests(30).length,
      last_run_time: lastRun.last_run || Date.now(),
    };
  }
}