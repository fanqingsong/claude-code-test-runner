// src/db/schema.ts

export interface TestRun {
  id?: number;
  run_id: string;
  start_time: number;
  end_time: number;
  total_tests: number;
  passed: number;
  failed: number;
  total_duration: number;
  environment?: string;
  created_at: number;
}

export interface TestCase {
  id?: number;
  run_id: number;
  test_id: string;
  description: string;
  status: "passed" | "failed";
  duration: number;
  start_time: number;
  end_time: number;
  message?: string;
}

export interface TestStep {
  id?: number;
  test_case_id: number;
  step_number: number;
  description: string;
  status: "passed" | "failed" | "pending";
  error_message?: string;
}

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    total_tests INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    total_duration INTEGER NOT NULL,
    environment TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    test_id TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    duration INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    message TEXT,
    FOREIGN KEY (run_id) REFERENCES test_runs(id)
  );

  CREATE TABLE IF NOT EXISTS test_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
  );

  CREATE INDEX IF NOT EXISTS idx_test_runs_start_time ON test_runs(start_time);
  CREATE INDEX IF NOT EXISTS idx_test_runs_run_id ON test_runs(run_id);
  CREATE INDEX IF NOT EXISTS idx_test_cases_run_id ON test_cases(run_id);
  CREATE INDEX IF NOT EXISTS idx_test_cases_test_id_status ON test_cases(test_id, status);
  CREATE INDEX IF NOT EXISTS idx_test_steps_test_case_id ON test_steps(test_case_id);
  CREATE INDEX IF NOT EXISTS idx_test_steps_status ON test_steps(status);
`;

export const CREATE_METADATA_TABLE = `
  CREATE TABLE IF NOT EXISTS _schema_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;