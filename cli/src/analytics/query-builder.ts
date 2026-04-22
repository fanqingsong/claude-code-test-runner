import { Database } from "bun:sqlite";

export interface PassRateTrend {
  date: string;
  pass_rate: number;
}

export interface TestDuration {
  test_id: string;
  avg_duration: number;
  run_count: number;
}

export interface FlakyTestInfo {
  test_id: string;
  total_runs: number;
  passes: number;
  failures: number;
  pass_rate: number;
}

export interface FailurePattern {
  description: string;
  failure_count: number;
  affected_tests: number;
}

export class QueryBuilder {
  constructor(private db: Database) {}

  getPassRateTrends(days: number = 30): PassRateTrend[] {
    const stmt = this.db.prepare(`
      SELECT
        DATE(start_time, 'unixepoch') as date,
        CAST(SUM(passed) AS REAL) * 100.0 / SUM(total_tests) as pass_rate
      FROM test_runs
      WHERE start_time >= strftime('%s', 'now', '-' || ? || ' days')
      GROUP BY date
      ORDER BY date
    `);
    return stmt.all(days) as PassRateTrend[];
  }

  getDurationTrends(days: number = 30): Array<{ date: string; test_id: string; avg_duration: number }> {
    const stmt = this.db.prepare(`
      SELECT
        DATE(tc.start_time, 'unixepoch') as date,
        tc.test_id,
        AVG(tc.duration) as avg_duration
      FROM test_cases tc
      JOIN test_runs tr ON tc.run_id = tr.id
      WHERE tr.start_time >= strftime('%s', 'now', '-' || ? || ' days')
      GROUP BY date, test_id
      ORDER BY date, avg_duration DESC
    `);
    return stmt.all(days) as any;
  }

  getSlowestTests(limit: number = 20): TestDuration[] {
    const stmt = this.db.prepare(`
      SELECT
        test_id,
        AVG(duration) as avg_duration,
        COUNT(*) as run_count
      FROM test_cases
      GROUP BY test_id
      ORDER BY avg_duration DESC
      LIMIT ?
    `);
    return stmt.all(limit) as TestDuration[];
  }

  getFlakyTests(days: number = 30): FlakyTestInfo[] {
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
      ORDER BY pass_rate ASC
    `);
    return stmt.all(days) as FlakyTestInfo[];
  }

  getFailurePatterns(limit: number = 10): FailurePattern[] {
    const stmt = this.db.prepare(`
      SELECT
        description,
        COUNT(*) as failure_count,
        COUNT(DISTINCT test_case_id) as affected_tests
      FROM test_steps
      WHERE status = 'failed'
      GROUP BY description
      ORDER BY failure_count DESC
      LIMIT ?
    `);
    return stmt.all(limit) as FailurePattern[];
  }

  getExecutionFrequency(days: number = 30): Array<{ test_id: string; date: string; run_count: number }> {
    const stmt = this.db.prepare(`
      SELECT
        tc.test_id,
        DATE(tr.start_time, 'unixepoch') as date,
        COUNT(*) as run_count
      FROM test_cases tc
      JOIN test_runs tr ON tc.run_id = tr.id
      WHERE tr.start_time >= strftime('%s', 'now', '-' || ? || ' days')
      GROUP BY tc.test_id, date
      ORDER BY date, tc.test_id
    `);
    return stmt.all(days) as any;
  }
}