/**
 * PostgreSQL Database Manager for Dashboard Service
 * Manages connection pool and database queries
 */

import pg from 'pg';
const { Pool } = pg;

export class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || 'claude_code_tests',
      user: process.env.POSTGRES_USER || 'cc_test_user',
      password: process.env.POSTGRES_PASSWORD,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  /**
   * Execute a query and return all rows
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.debug('Executed query', { text, duration, rows: res.rowCount });
      return res.rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get recent test runs
   */
  async getRecentTestRuns(limit = 100) {
    const text = `
      SELECT
        tr.id, tr.run_id, tr.start_time, tr.end_time, tr.total_tests, tr.passed, tr.failed, tr.skipped,
        tr.total_duration_ms, tr.status, tr.created_at, tr.test_definition_id,
        td.name as test_name
      FROM test_runs tr
      LEFT JOIN test_definitions td ON tr.test_definition_id = td.id
      ORDER BY tr.created_at DESC
      LIMIT $1
    `;
    return await this.query(text, [limit]);
  }

  /**
   * Get test cases for a specific run
   */
  async getTestCasesForRun(runId) {
    const text = `
      SELECT
        id, test_id, description, status, duration, start_time, end_time,
        error_message, screenshot_path, created_at
      FROM test_cases
      WHERE run_id = $1
      ORDER BY id
    `;
    return await this.query(text, [runId]);
  }

  /**
   * Get dashboard summary data
   */
  async getDashboardSummary(days = 30) {
    const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const text = `
      SELECT
        COUNT(*) as total_runs,
        SUM(passed) as total_passed,
        SUM(failed) as total_failed,
        SUM(total_tests) as total_tests,
        AVG(total_duration_ms) as avg_duration,
        COUNT(CASE WHEN status = 'passed' THEN 1 END) as successful_runs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
        COUNT(CASE WHEN total_duration_ms IS NOT NULL THEN 1 END) as runs_with_duration
      FROM test_runs
      WHERE created_at > $1
    `;

    const result = await this.query(text, [startTime]);
    return result[0];
  }

  /**
   * Get total count of test definitions
   */
  async getTotalTestDefinitions() {
    const text = `
      SELECT COUNT(*) as total_definitions
      FROM test_definitions
      WHERE is_active = true
    `;
    const result = await this.query(text);
    return result[0].total_definitions;
  }

  /**
   * Get test runs grouped by day
   */
  async getTestRunsByDay(days = 30) {
    const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const text = `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as total_runs,
        SUM(passed) as total_passed,
        SUM(failed) as total_failed,
        SUM(total_tests) as total_tests
      FROM test_runs
      WHERE created_at > $1
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `;

    return await this.query(text, [startTime]);
  }

  /**
   * Get slowest tests
   */
  async getSlowestTests(limit = 20) {
    const text = `
      SELECT
        test_id,
        AVG(duration) as avg_duration,
        COUNT(*) as run_count,
        MAX(duration) as max_duration
      FROM test_cases
      WHERE status = 'passed'
      GROUP BY test_id
      ORDER BY avg_duration DESC
      LIMIT $1
    `;

    return await this.query(text, [limit]);
  }

  /**
   * Get flaky tests (tests with both passes and failures)
   */
  async getFlakyTests(days = 30) {
    const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const text = `
      SELECT
        tc.test_id,
        COUNT(*) as total_runs,
        SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
        SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
        CASE
          WHEN COUNT(*) > 0 THEN
            100.0 * SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) / COUNT(*)
          ELSE 0
        END as failure_rate
      FROM test_cases tc
      JOIN test_runs tr ON tc.run_id = tr.id
      WHERE tr.start_time > $1
      GROUP BY tc.test_id
      HAVING COUNT(*) > 1 AND SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) > 0
      ORDER BY failure_rate DESC
    `;

    return await this.query(text, [startTime]);
  }

  /**
   * Get failure patterns
   */
  async getFailurePatterns(limit = 10) {
    const text = `
      SELECT
        error_message,
        COUNT(*) as count,
        MAX(test_id) as example_test
      FROM test_cases
      WHERE status = 'failed' AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT $1
    `;

    return await this.query(text, [limit]);
  }

  /**
   * Get test run by run_id string
   */
  async getTestRunByRunId(runId) {
    const text = `
      SELECT
        id, run_id, start_time, end_time, total_tests, passed, failed, skipped,
        total_duration, status, environment, triggered_by, created_at
      FROM test_runs
      WHERE run_id = $1
    `;

    const result = await this.query(text, [runId]);
    return result[0] || null;
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
    console.log('Database connection pool closed');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      return { status: 'unhealthy', database: 'disconnected', error: error.message };
    }
  }
}
