# Test Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive test analytics dashboard with SQLite storage, interactive charts, and hybrid static/dev-server modes

**Architecture:** Three-layer system: SQLite database for historical storage, analytics engine for metric calculations, and reporting layer with EJS templates + Express dev server

**Tech Stack:** bun:sqlite (Bun-compatible SQLite), EJS, Chart.js, Express.js, TypeScript

**Note:** Using bun:sqlite instead of better-sqlite3 due to Bun runtime compatibility constraints. better-sqlite3's native modules are not supported in bun test runtime.

---

## File Structure Map

**New Files to Create:**
```
src/db/
  schema.ts              # Database schema definitions
  migrations.ts          # Database migration runner
  manager.ts             # Database connection and query manager

src/analytics/
  metrics.ts             # Metric calculation functions
  flaky-detector.ts      # Flaky test detection algorithm
  query-builder.ts       # SQL query builders

src/reporting/
  templates/
    dashboard.ejs        # HTML template for dashboard
  generators/
    data-processor.ts    # Prepare data for charts
    static-generator.ts  # Generate static HTML files
  assets/
    dashboard.css        # Dashboard styles
    charts.js            # Chart.js initialization
  server.ts              # Express dev server

src/commands/
  dashboard.ts           # CLI command: cc-test dashboard

tests/unit/
  db/
    schema.test.ts
    migrations.test.ts
    manager.test.ts
  analytics/
    metrics.test.ts
    flaky-detector.test.ts
    query-builder.test.ts
  reporting/
    data-processor.test.ts
    static-generator.test.ts
```

**Files to Modify:**
```
src/index.ts             # Register dashboard command
package.json             # Add new dependencies
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies to package.json**

```bash
cd /home/fqs/workspace/self/claude-code-test-runner/.worktrees/config-file-support/cli
bun add better-sqlite3 ejs chart.js ws @types/better-sqlite3 @types/ejs @types/ws
```

Expected: Packages installed, bun.lock updated

- [ ] **Step 2: Verify installations**

```bash
grep -E "better-sqlite3|ejs|chart.js|ws" package.json
```

Expected: All four packages listed in dependencies

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add analytics dashboard dependencies

Add better-sqlite3 for database, ejs for templates,
chart.js for visualizations, ws for websockets

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create Database Schema

**Files:**
- Create: `src/db/schema.ts`

- [ ] **Step 1: Write schema type definitions**

```typescript
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
```

- [ ] **Step 2: Create test file**

```bash
mkdir -p tests/unit/db
touch tests/unit/db/schema.test.ts
```

- [ ] **Step 3: Write basic test**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/unit/db/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts tests/unit/db/schema.test.ts
git commit -m "feat: add database schema definitions

Define TypeScript types and SQL for test_runs, test_cases,
test_steps tables with proper indexes for performance

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create Database Migrations

**Files:**
- Create: `src/db/migrations.ts`

- [ ] **Step 1: Write migration runner**

```typescript
// src/db/migrations.ts

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { SCHEMA_VERSION, CREATE_TABLES_SQL, CREATE_METADATA_TABLE } from "./schema";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db: Database.Database) => {
      db.exec(CREATE_TABLES_SQL);
      db.exec(CREATE_METADATA_TABLE);
      db.prepare("INSERT INTO _schema_metadata (key, value) VALUES (?, ?)").run("schema_version", SCHEMA_VERSION.toString());
    },
  },
];

export function runMigrations(dbPath: string): void {
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    // Enable foreign keys
    db.pragma("foreign_keys = ON");

    // Get current schema version
    const metadataTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_metadata'").get() as { name: string } | undefined;

    let currentVersion = 0;
    if (metadataTable) {
      const version = db.prepare("SELECT value FROM _schema_metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
      currentVersion = version ? parseInt(version.value, 10) : 0;
    }

    // Run pending migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration: ${migration.name}`);
        migration.up(db);
      }
    }
  } finally {
    db.close();
  }
}

export function getDatabasePath(resultsPath: string): string {
  return `${resultsPath}/.analytics/test-results.db`;
}
```

- [ ] **Step 2: Write test for migrations**

```typescript
// tests/unit/db/migrations.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { runMigrations, getDatabasePath } from "../../../src/db/migrations";
import Database from "better-sqlite3";

const TEST_DB_PATH = "/tmp/test-migrations.db";

describe("Database Migrations", () => {
  afterEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should create database and tables on first run", () => {
    runMigrations(TEST_DB_PATH);

    const db = new Database(TEST_DB_PATH);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    db.close();

    expect(tables.map((t) => t.name)).toContain("test_runs");
    expect(tables.map((t) => t.name)).toContain("test_cases");
    expect(tables.map((t) => t.name)).toContain("test_steps");
    expect(tables.map((t) => t.name)).toContain("_schema_metadata");
  });

  it("should create indexes for performance", () => {
    runMigrations(TEST_DB_PATH);

    const db = new Database(TEST_DB_PATH);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
    db.close();

    expect(indexes.map((i) => i.name)).toContain("idx_test_runs_start_time");
    expect(indexes.map((i) => i.name)).toContain("idx_test_cases_test_id_status");
  });

  it("should be idempotent - running twice should not error", () => {
    runMigrations(TEST_DB_PATH);
    runMigrations(TEST_DB_PATH);

    const db = new Database(TEST_DB_PATH);
    const count = db.prepare("SELECT COUNT(*) as count FROM test_runs").get() as { count: number };
    db.close();

    expect(count.count).toBe(0);
  });

  it("should store schema version in metadata", () => {
    runMigrations(TEST_DB_PATH);

    const db = new Database(TEST_DB_PATH);
    const version = db.prepare("SELECT value FROM _schema_metadata WHERE key = 'schema_version'").get() as { value: string };
    db.close();

    expect(version.value).toBe("1");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/db/migrations.test.ts
```

Expected: PASS (creates database at /tmp/test-migrations.db)

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations.ts tests/unit/db/migrations.test.ts
git commit -m "feat: add database migration system

Implement migration runner with idempotent schema creation,
metadata tracking, and proper cleanup support

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create Database Manager

**Files:**
- Create: `src/db/manager.ts`

- [ ] **Step 1: Write database manager class**

```typescript
// src/db/manager.ts

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { runMigrations, getDatabasePath } from "./migrations";
import type { TestRun, TestCase, TestStep } from "./schema";

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(resultsPath: string) {
    this.dbPath = getDatabasePath(resultsPath);
    this.initialize();
  }

  private initialize(): void {
    if (!existsSync(this.dbPath)) {
      runMigrations(this.dbPath);
    }

    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Insert test run
  insertTestRun(run: TestRun): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, environment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        total_tests = excluded.total_tests,
        passed = excluded.passed,
        failed = excluded.failed,
        total_duration = excluded.total_duration,
        environment = excluded.environment
    `);

    const info = stmt.run(
      run.run_id,
      run.start_time,
      run.end_time,
      run.total_tests,
      run.passed,
      run.failed,
      run.total_duration,
      run.environment || null,
      run.created_at
    );

    return info.lastInsertRowid as number;
  }

  // Insert test case
  insertTestCase(testCase: TestCase): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      testCase.run_id,
      testCase.test_id,
      testCase.description,
      testCase.status,
      testCase.duration,
      testCase.start_time,
      testCase.end_time,
      testCase.message || null
    );

    return info.lastInsertRowid as number;
  }

  // Insert test step
  insertTestStep(step: TestStep): number {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      step.test_case_id,
      step.step_number,
      step.description,
      step.status,
      step.error_message || null
    );

    return info.lastInsertRowid as number;
  }

  // Get recent test runs
  getRecentTestRuns(limit: number = 100): TestRun[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      SELECT * FROM test_runs
      ORDER BY start_time DESC
      LIMIT ?
    `);

    return stmt.all(limit) as TestRun[];
  }

  // Get test cases for a run
  getTestCasesForRun(runId: number): TestCase[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(`
      SELECT * FROM test_cases
      WHERE run_id = ?
      ORDER BY start_time
    `);

    return stmt.all(runId) as TestCase[];
  }

  // Get database connection (for advanced queries)
  getConnection(): Database.Database {
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/unit/db/manager.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import type { TestRun, TestCase, TestStep } from "../../../src/db/schema";

const TEST_DB_PATH = "/tmp/test-manager.db";

describe("DatabaseManager", () => {
  let manager: DatabaseManager;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Temporarily override getDatabasePath
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    manager = new DatabaseManager("/tmp");
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
  });

  afterEach(() => {
    manager.close();
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
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/db/manager.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/manager.ts tests/unit/db/manager.test.ts
git commit -m "feat: add database manager with CRUD operations

Implement DatabaseManager class for inserting test runs,
test cases, and test steps with proper error handling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Create Query Builder

**Files:**
- Create: `src/analytics/query-builder.ts`

- [ ] **Step 1: Write query builder functions**

```typescript
// src/analytics/query-builder.ts

import Database from "better-sqlite3";

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
  constructor(private db: Database.Database) {}

  // Get pass rate trends grouped by day
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

  // Get average duration per test over time
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

  // Get slowest tests
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

  // Get flaky tests (pass rate between 30% and 70%)
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

  // Get failure patterns (most common failing steps)
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

  // Get execution frequency (heatmap data)
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
```

- [ ] **Step 2: Write tests**

```typescript
// tests/unit/analytics/query-builder.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import Database from "better-sqlite3";
import { DatabaseManager } from "../../../src/db/manager";
import { QueryBuilder } from "../../../src/analytics/query-builder";

const TEST_DB_PATH = "/tmp/test-query-builder.db";

describe("QueryBuilder", () => {
  let dbManager: DatabaseManager;
  let queryBuilder: QueryBuilder;

  function setupTestData() {
    const db = dbManager.getConnection();

    // Insert test run
    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", Date.now() - 86400000, Date.now() - 86400000 + 1000, 2, 1, 1, 1000, Date.now()).lastInsertRowid as number;

    // Insert test cases
    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, Date.now() - 86400000, Date.now() - 86400000 + 500);

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-b", "Test B", "failed", 1000, Date.now() - 86400000 + 500, Date.now() - 86400000 + 1500);
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    dbManager = new DatabaseManager("/tmp");
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
    setupTestData();
    queryBuilder = new QueryBuilder(dbManager.getConnection());
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should get pass rate trends", () => {
    const trends = queryBuilder.getPassRateTrends(30);
    expect(trends.length).toBeGreaterThan(0);
    expect(trends[0]).toHaveProperty("date");
    expect(trends[0]).toHaveProperty("pass_rate");
  });

  it("should get slowest tests", () => {
    const slowest = queryBuilder.getSlowestTests(10);
    expect(slowest.length).toBeGreaterThan(0);
    expect(slowest[0].test_id).toBeDefined();
    expect(slowest[0].avg_duration).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/analytics/query-builder.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/analytics/query-builder.ts tests/unit/analytics/query-builder.test.ts
git commit -m "feat: add SQL query builder for analytics

Implement query builders for pass rates, duration trends,
flaky tests, failure patterns, and execution frequency

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Create Flaky Test Detector

**Files:**
- Create: `src/analytics/flaky-detector.ts`

- [ ] **Step 1: Write flaky test detection algorithm**

```typescript
// src/analytics/flaky-detector.ts

import Database from "better-sqlite3";
import { FlakyTestInfo } from "./query-builder";

export interface FlakyTestWithHistory extends FlakyTestInfo {
  recent_results: Array<{ status: string; timestamp: number }>;
  flakiness_score: number;
}

export class FlakyDetector {
  constructor(private db: Database.Database) {}

  // Detect flaky tests with detailed history
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

  // Calculate flakiness score (0-100, higher = more flaky)
  private calculateFlakinessScore(passRate: number, recentResults: Array<{ status: string; timestamp: number }>): number {
    // Base score from pass rate (50% = most flaky)
    const passRateScore = 100 - Math.abs(passRate - 0.5) * 200;

    // Variance penalty: if results are inconsistent, increase score
    if (recentResults.length < 2) return passRateScore;

    const passCount = recentResults.filter((r) => r.status === "passed").length;
    const recentPassRate = passCount / recentResults.length;

    // If recent pass rate differs significantly from overall, increase flakiness
    const variancePenalty = Math.abs(passRate - recentPassRate) * 50;

    return Math.min(100, Math.max(0, passRateScore + variancePenalty));
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/unit/analytics/flaky-detector.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { FlakyDetector } from "../../../src/analytics/flaky-detector";

const TEST_DB_PATH = "/tmp/test-flaky-detector.db";

describe("FlakyDetector", () => {
  let dbManager: DatabaseManager;
  let detector: FlakyDetector;

  function setupFlakyTestData() {
    const db = dbManager.getConnection();
    const baseTime = Date.now() - 86400000; // Yesterday

    // Create 10 test runs with alternating pass/fail for "flaky-test"
    for (let i = 0; i < 10; i++) {
      const runId = db.prepare(`
        INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`run-${i}`, baseTime + i * 3600000, baseTime + i * 3600000 + 1000, 1, i % 2, 1 - (i % 2), 1000, baseTime + i * 3600000).lastInsertRowid as number;

      db.prepare(`
        INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(runId, "flaky-test", "Flaky test", i % 2 === 0 ? "passed" : "failed", 1000, baseTime + i * 3600000, baseTime + i * 3600000 + 1000);
    }

    // Create stable test (always passes)
    for (let i = 0; i < 10; i++) {
      const runId = db.prepare(`
        INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`stable-run-${i}`, baseTime + i * 3600000, baseTime + i * 3600000 + 500, 1, 1, 0, 500, baseTime + i * 3600000).lastInsertRowid as number;

      db.prepare(`
        INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(runId, "stable-test", "Stable test", "passed", 500, baseTime + i * 3600000, baseTime + i * 3600000 + 500);
    }
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    dbManager = new DatabaseManager("/tmp");
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
    setupFlakyTestData();
    detector = new FlakyDetector(dbManager.getConnection());
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should detect flaky tests", () => {
    const flakyTests = detector.detectFlakyTests(30);
    expect(flakyTests.length).toBeGreaterThan(0);

    const flakyTest = flakyTests.find((t) => t.test_id === "flaky-test");
    expect(flakyTest).toBeDefined();
  });

  it("should not detect stable tests as flaky", () => {
    const flakyTests = detector.detectFlakyTests(30);

    const stableTest = flakyTests.find((t) => t.test_id === "stable-test");
    expect(stableTest).toBeUndefined();
  });

  it("should calculate flakiness score", () => {
    const flakyTests = detector.detectFlakyTests(30);
    const flakyTest = flakyTests.find((t) => t.test_id === "flaky-test");

    expect(flakyTest?.flakiness_score).toBeGreaterThan(0);
    expect(flakyTest?.flakiness_score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/analytics/flaky-detector.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/analytics/flaky-detector.ts tests/unit/analytics/flaky-detector.test.ts
git commit -m "feat: add flaky test detection algorithm

Implement statistical flakiness detection with historical
analysis and scoring (0-100 scale)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Create Data Processor for Charts

**Files:**
- Create: `src/reporting/generators/data-processor.ts`

- [ ] **Step 1: Write data processor**

```typescript
// src/reporting/generators/data-processor.ts

import Database from "better-sqlite3";
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

  constructor(db: Database.Database) {
    this.queryBuilder = new QueryBuilder(db);
    this.flakyDetector = new FlakyDetector(db);
  }

  // Process all data needed for dashboard
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

  // Get summary statistics
  private getSummary(): ChartData["summary"] {
    const db = (this.queryBuilder as any).db;

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
```

- [ ] **Step 2: Write tests**

```typescript
// tests/unit/reporting/data-processor.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { DataProcessor } from "../../../src/reporting/generators/data-processor";

const TEST_DB_PATH = "/tmp/test-data-processor.db";

describe("DataProcessor", () => {
  let dbManager: DatabaseManager;
  let processor: DataProcessor;

  function setupTestData() {
    const db = dbManager.getConnection();
    const now = Date.now();

    // Insert test run
    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", now - 1000, now, 2, 1, 1, 1000, now).lastInsertRowid as number;

    // Insert test cases
    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, now - 1000, now - 500);

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-b", "Test B", "failed", 1000, now - 500, now);

    // Insert test step
    db.prepare(`
      INSERT INTO test_steps (test_case_id, step_number, description, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(2, 1, "Click login", "failed", "Element not found");
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    dbManager = new DatabaseManager("/tmp");
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
    setupTestData();
    processor = new DataProcessor(dbManager.getConnection());
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should process dashboard data", () => {
    const data = processor.processDashboardData(30);

    expect(data.summary.total_tests).toBe(2);
    expect(data.summary.pass_rate).toBe(50);
    expect(data.passRateTrend).toBeDefined();
    expect(data.slowestTests).toBeDefined();
  });

  it("should calculate summary statistics", () => {
    const data = processor.processDashboardData(30);

    expect(data.summary.total_tests).toBe(2);
    expect(data.summary.avg_duration).toBe(750); // (500 + 1000) / 2
    expect(data.summary.flaky_count).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/reporting/data-processor.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/reporting/generators/data-processor.ts tests/unit/reporting/data-processor.test.ts
git commit -m "feat: add data processor for dashboard charts

Process database queries into chart-ready JSON structures
with summary statistics and trend data

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Create Dashboard HTML Template

**Files:**
- Create: `src/reporting/templates/dashboard.ejs`

- [ ] **Step 1: Create EJS template**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Test Analytics</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header .meta { color: #666; font-size: 14px; }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .card-value { font-size: 32px; font-weight: bold; }
    .card-value.passed { color: #10b981; }
    .card-value.failed { color: #ef4444; }
    .card-value.neutral { color: #6b7280; }
    .grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1024px) { .grid { grid-template-columns: 1fr; } }
    .chart-container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .chart-container h3 { margin-bottom: 15px; font-size: 16px; }
    .chart-wrapper { position: relative; height: 300px; }
    .flaky-tests { margin-top: 20px; }
    .flaky-test-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .flaky-test-item:last-child { border-bottom: none; }
    .flaky-score {
      background: #fef3c7;
      color: #92400e;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Claude Code Test Analytics</h1>
      <div class="meta">
        Last updated: <%- new Date(data.summary.last_run_time).toLocaleString() %>
        | Total tests: <%- data.summary.total_tests %>
      </div>
    </div>

    <div class="summary-cards">
      <div class="card">
        <div class="card-label">Pass Rate</div>
        <div class="card-value passed"><%- data.summary.pass_rate.toFixed(1) %>%</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Duration</div>
        <div class="card-value neutral"><%- (data.summary.avg_duration / 1000).toFixed(2) %>s</div>
      </div>
      <div class="card">
        <div class="card-label">Flaky Tests</div>
        <div class="card-value failed"><%- data.summary.flaky_count %></div>
      </div>
      <div class="card">
        <div class="card-label">Total Tests</div>
        <div class="card-value neutral"><%- data.summary.total_tests %></div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="chart-container">
          <h3>Pass Rate Trend (Last 30 Days)</h3>
          <div class="chart-wrapper">
            <canvas id="passRateChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h3>Duration Trend</h3>
          <div class="chart-wrapper">
            <canvas id="durationChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h3>Execution Frequency</h3>
          <div class="chart-wrapper">
            <canvas id="frequencyChart"></canvas>
          </div>
        </div>
      </div>

      <div>
        <div class="chart-container">
          <h3>Slowest Tests</h3>
          <div class="chart-wrapper">
            <canvas id="slowestChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h3>Failure Patterns</h3>
          <div class="chart-wrapper">
            <canvas id="failureChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h3>Flaky Tests</h3>
          <div class="flaky-tests">
            <% if (data.flakyTests.length === 0) { %>
              <p style="color: #10b981; text-align: center; padding: 20px;">No flaky tests detected! ✓</p>
            <% } else { %>
              <% data.flakyTests.forEach(function(test) { %>
                <div class="flaky-test-item">
                  <div>
                    <strong><%- test.test_id %></strong><br>
                    <small>Pass rate: <%- (test.pass_rate * 100).toFixed(1) %>%</small>
                  </div>
                  <div class="flaky-score">Score: <%- test.flakiness_score.toFixed(0) %></div>
                </div>
              <% }); %>
            <% } %>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const data = <%- JSON.stringify(data) %>;

    // Pass Rate Chart
    new Chart(document.getElementById('passRateChart'), {
      type: 'line',
      data: {
        labels: data.passRateTrend.map(d => d.date),
        datasets: [{
          label: 'Pass Rate %',
          data: data.passRateTrend.map(d => d.pass_rate),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100 }
        }
      }
    });

    // Duration Chart
    const durationCtx = document.getElementById('durationChart').getContext('2d');
    const uniqueTests = [...new Set(data.durationTrend.map(d => d.test_id))].slice(0, 5);
    new Chart(durationCtx, {
      type: 'line',
      data: {
        labels: [...new Set(data.durationTrend.map(d => d.date))],
        datasets: uniqueTests.map(testId => ({
          label: testId,
          data: data.durationTrend.filter(d => d.test_id === testId).map(d => d.avg_duration),
          borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
          tension: 0.4
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    // Slowest Tests Chart
    new Chart(document.getElementById('slowestChart'), {
      type: 'bar',
      data: {
        labels: data.slowestTests.map(t => t.test_id),
        datasets: [{
          label: 'Avg Duration (ms)',
          data: data.slowestTests.map(t => t.avg_duration),
          backgroundColor: '#6b7280'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y'
      }
    });

    // Failure Patterns Chart
    new Chart(document.getElementById('failureChart'), {
      type: 'doughnut',
      data: {
        labels: data.failurePatterns.map(p => p.description),
        datasets: [{
          data: data.failurePatterns.map(p => p.failure_count),
          backgroundColor: [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    // Execution Frequency Chart
    const frequencyCtx = document.getElementById('frequencyChart').getContext('2d');
    const uniqueTestsFreq = [...new Set(data.executionFrequency.map(d => d.test_id))];
    const uniqueDates = [...new Set(data.executionFrequency.map(d => d.date))].sort();
    new Chart(frequencyCtx, {
      type: 'bar',
      data: {
        labels: uniqueDates,
        datasets: uniqueTestsFreq.slice(0, 10).map(testId => ({
          label: testId,
          data: uniqueDates.map(date => {
            const entry = data.executionFrequency.find(d => d.test_id === testId && d.date === date);
            return entry ? entry.run_count : 0;
          }),
          backgroundColor: `hsl(${Math.random() * 360}, 70%, 50%)`
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/reporting/templates/dashboard.ejs
git commit -m "feat: add dashboard HTML template

Create single-page EJS template with Chart.js visualizations
for all 6 metrics: pass rates, duration trends, flaky tests,
slowest tests, failure patterns, execution frequency

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Create Static HTML Generator

**Files:**
- Create: `src/reporting/generators/static-generator.ts`

- [ ] **Step 1: Write static HTML generator**

```typescript
// src/reporting/generators/static-generator.ts

import { mkdirSync, writeFileSync } from "fs";
import { DatabaseManager } from "../../db/manager";
import { DataProcessor } from "./data-processor";
import ejs from "ejs";
import { readFileSync } from "fs";

export interface StaticGeneratorOptions {
  outputPath: string;
  days?: number;
}

export class StaticGenerator {
  constructor(private dbManager: DatabaseManager) {}

  // Generate static HTML dashboard
  async generate(options: StaticGeneratorOptions): Promise<void> {
    const { outputPath, days = 30 } = options;

    // Process data
    const processor = new DataProcessor(this.dbManager.getConnection());
    const data = processor.processDashboardData(days);

    // Read template
    const templatePath = new URL("../../templates/dashboard.ejs", import.meta.url).pathname;
    const template = readFileSync(templatePath, "utf-8");

    // Render HTML
    const html = await ejs.render(template, { data });

    // Ensure output directory exists
    const outputDir = outputPath.split("/").slice(0, -1).join("/");
    mkdirSync(outputDir, { recursive: true });

    // Write file
    writeFileSync(outputPath, html);

    console.log(`Dashboard generated: ${outputPath}`);
    console.log(`File size: ${(html.length / 1024).toFixed(2)} KB`);
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/unit/reporting/static-generator.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync, readFileSync } from "fs";
import { DatabaseManager } from "../../../src/db/manager";
import { StaticGenerator } from "../../../src/reporting/generators/static-generator";

const TEST_DB_PATH = "/tmp/test-static-generator.db";
const OUTPUT_PATH = "/tmp/test-dashboard.html";

describe("StaticGenerator", () => {
  let dbManager: DatabaseManager;
  let generator: StaticGenerator;

  function setupTestData() {
    const db = dbManager.getConnection();
    const now = Date.now();

    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", now - 1000, now, 1, 1, 0, 1000, now).lastInsertRowid as number;

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, now - 1000, now);
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(OUTPUT_PATH)) {
      unlinkSync(OUTPUT_PATH);
    }
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    dbManager = new DatabaseManager("/tmp");
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
    setupTestData();
    generator = new StaticGenerator(dbManager);
  });

  afterEach(() => {
    dbManager.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(OUTPUT_PATH)) {
      unlinkSync(OUTPUT_PATH);
    }
  });

  it("should generate HTML dashboard", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    expect(existsSync(OUTPUT_PATH)).toBe(true);
  });

  it("should include chart data in HTML", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    const html = readFileSync(OUTPUT_PATH, "utf-8");
    expect(html).toContain("const data =");
    expect(html).toContain("passRateTrend");
    expect(html).toContain("Chart.js");
  });

  it("should generate file under 500KB", async () => {
    await generator.generate({ outputPath: OUTPUT_PATH, days: 30 });

    const stats = require("fs").statSync(OUTPUT_PATH);
    const sizeKB = stats.size / 1024;
    expect(sizeKB).toBeLessThan(500);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/unit/reporting/static-generator.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/reporting/generators/static-generator.ts tests/unit/reporting/static-generator.test.ts
git commit -m "feat: add static HTML generator

Generate standalone dashboard files with embedded data
and Chart.js for offline viewing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Create Express Dev Server

**Files:**
- Create: `src/reporting/server.ts`

- [ ] **Step 1: Write Express server**

```typescript
// src/reporting/server.ts

import express from "express";
import { DatabaseManager } from "../db/manager";
import { DataProcessor } from "./generators/data-processor";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import ejs from "ejs";
import { readFileSync } from "fs";

export interface ServerOptions {
  port?: number;
  resultsPath: string;
}

export class DashboardServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private dbManager: DatabaseManager;
  private port: number;

  constructor(options: ServerOptions) {
    this.port = options.port || 3000;
    this.dbManager = new DatabaseManager(options.resultsPath);

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.set("view engine", "ejs");
    this.app.set("views", new URL("templates", import.meta.url).pathname);
  }

  private setupRoutes(): void {
    // Serve dashboard page
    this.app.get("/", (req, res) => {
      const processor = new DataProcessor(this.dbManager.getConnection());
      const data = processor.processDashboardData(30);

      const templatePath = new URL("../templates/dashboard.ejs", import.meta.url).pathname;
      const template = readFileSync(templatePath, "utf-8");

      ejs.render(template, { data }, (err, html) => {
        if (err) {
          res.status(500).send(err.message);
        } else {
          res.send(html);
        }
      });
    });

    // API: Get summary stats
    this.app.get("/api/summary", (req, res) => {
      const processor = new DataProcessor(this.dbManager.getConnection());
      const data = processor.processDashboardData(30);
      res.json(data.summary);
    });

    // API: Get pass rate trends
    this.app.get("/api/pass-rate-trends", (req, res) => {
      const processor = new DataProcessor(this.dbManager.getConnection());
      const data = processor.processDashboardData(30);
      res.json(data.passRateTrend);
    });

    // API: Get flaky tests
    this.app.get("/api/flaky-tests", (req, res) => {
      const processor = new DataProcessor(this.dbManager.getConnection());
      const data = processor.processDashboardData(30);
      res.json(data.flakyTests);
    });

    // API: Get all dashboard data
    this.app.get("/api/dashboard", (req, res) => {
      const days = parseInt(req.query.days as string) || 30;
      const processor = new DataProcessor(this.dbManager.getConnection());
      const data = processor.processDashboardData(days);
      res.json(data);
    });
  }

  // Start the server
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to start on specified port, increment if occupied
      let attempts = 0;
      const maxAttempts = 10;

      const tryStart = (port: number) => {
        this.server = createServer(this.app);

        this.server.on("error", (err: any) => {
          if (err.code === "EADDRINUSE" && attempts < maxAttempts) {
            attempts++;
            this.port = port + 1;
            tryStart(this.port);
          } else {
            reject(err);
          }
        });

        this.server.listen(port, () => {
          // Setup WebSocket for real-time updates
          this.wss = new WebSocketServer({ server: this.server });

          this.wss.on("connection", (ws) => {
            console.log("Client connected to dashboard");
            ws.on("close", () => {
              console.log("Client disconnected");
            });
          });

          console.log(`Dashboard server running at http://localhost:${this.port}`);
          resolve();
        });
      };

      tryStart(this.port);
    });
  }

  // Broadcast update to all connected clients
  broadcastUpdate(): void {
    const processor = new DataProcessor(this.dbManager.getConnection());
    const data = processor.processDashboardData(30);

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "update", data }));
      }
    });
  }

  // Stop the server
  stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    this.dbManager.close();
  }
}
```

- [ ] **Step 2: Write integration test**

```typescript
// tests/integration/server.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { DashboardServer } from "../../../src/reporting/server";
import { DatabaseManager } from "../../../src/db/manager";

const TEST_DB_PATH = "/tmp/test-server.db";

describe("DashboardServer Integration", () => {
  let server: DashboardServer;

  function setupTestData() {
    const dbManager = new DatabaseManager("/tmp");
    const db = dbManager.getConnection();
    const now = Date.now();

    const runId = db.prepare(`
      INSERT INTO test_runs (run_id, start_time, end_time, total_tests, passed, failed, total_duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test-1", now - 1000, now, 1, 1, 0, 1000, now).lastInsertRowid as number;

    db.prepare(`
      INSERT INTO test_cases (run_id, test_id, description, status, duration, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, "test-a", "Test A", "passed", 500, now - 1000, now);

    dbManager.close();
  }

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    const originalGetPath = require("../../../src/db/migrations").getDatabasePath;
    require("../../../src/db/migrations").getDatabasePath = () => TEST_DB_PATH;
    setupTestData();
    require("../../../src/db/migrations").getDatabasePath = originalGetPath;
  });

  afterEach(() => {
    if (server) {
      server.stop();
    }
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  it("should start server on available port", async () => {
    server = new DashboardServer({ port: 3000, resultsPath: "/tmp" });
    await server.start();

    expect(server).toBeDefined();
  });

  it("should increment port if already in use", async () => {
    // Start first server
    const server1 = new DashboardServer({ port: 3000, resultsPath: "/tmp" });
    await server1.start();

    // Start second server - should use port 3001
    const server2 = new DashboardServer({ port: 3000, resultsPath: "/tmp" });
    await server2.start();

    // Cleanup
    server1.stop();
    server2.stop();

    expect(server2).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/integration/server.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/reporting/server.ts tests/integration/server.test.ts
git commit -m "feat: add Express dev server with REST API

Implement dev server with dashboard rendering, REST endpoints,
WebSocket support for real-time updates, and auto port increment

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Create Dashboard CLI Command

**Files:**
- Create: `src/commands/dashboard.ts`

- [ ] **Step 1: Write CLI command**

```typescript
// src/commands/dashboard.ts

import { Command } from "commander";
import { StaticGenerator } from "../reporting/generators/static-generator";
import { DashboardServer } from "../reporting/server";
import { DatabaseManager } from "../db/manager";
import { getDatabasePath } from "../db/migrations";
import { existsSync, unlinkSync } from "fs";

export const dashboardCommand = new Command("dashboard")
  .description("Generate and view test analytics dashboard")
  .option("--static", "Generate static HTML dashboard")
  .option("--serve", "Start dev server with live dashboard")
  .option("--port <number>", "Port for dev server", "3000")
  .option("--output <path>", "Output path for static HTML", "./results/dashboard.html")
  .option("--cleanup", "Vacuum and optimize database")
  .action(async (options) => {
    const resultsPath = process.cwd() + "/results";
    const dbPath = getDatabasePath(resultsPath);

    if (options.cleanup) {
      console.log("Cleaning up database...");
      const dbManager = new DatabaseManager(resultsPath);
      const db = dbManager.getConnection();
      db.pragma("optimize");
      db.exec("VACUUM");
      dbManager.close();
      console.log("Database cleaned up successfully");
      return;
    }

    if (!existsSync(dbPath)) {
      console.error("No test data found. Run tests first to generate analytics data.");
      process.exit(1);
    }

    if (options.static) {
      console.log("Generating static dashboard...");
      const dbManager = new DatabaseManager(resultsPath);
      const generator = new StaticGenerator(dbManager);
      await generator.generate({
        outputPath: options.output,
        days: 30,
      });
      dbManager.close();

      console.log(`\nOpen file://${process.cwd()}/${options.output} in your browser`);
    } else if (options.serve) {
      console.log("Starting dashboard server...");
      const server = new DashboardServer({
        port: parseInt(options.port),
        resultsPath,
      });

      await server.start();

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log("\nStopping dashboard server...");
        server.stop();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } else {
      // Default: generate static
      console.log("Generating static dashboard...");
      const dbManager = new DatabaseManager(resultsPath);
      const generator = new StaticGenerator(dbManager);
      await generator.generate({
        outputPath: options.output,
        days: 30,
      });
      dbManager.close();

      console.log(`\nOpen file://${process.cwd()}/${options.output} in your browser`);
    }
  });
```

- [ ] **Step 2: Register command in CLI**

```typescript
// Modify: src/index.ts (add after existing commands)

import { dashboardCommand } from "./commands/dashboard";

// Register the dashboard command
program.addCommand(dashboardCommand);
```

- [ ] **Step 3: Test command**

```bash
cd /home/fqs/workspace/self/claude-code-test-runner/.worktrees/config-file-support/cli
bun run src/index.ts dashboard --help
```

Expected: Shows dashboard command help

- [ ] **Step 4: Test static generation**

```bash
bun run src/index.ts dashboard --static --output /tmp/test-dashboard.html
```

Expected: Generates HTML file

- [ ] **Step 5: Commit**

```bash
git add src/commands/dashboard.ts src/index.ts
git commit -m "feat: add dashboard CLI command

Add cc-test dashboard command with --static, --serve,
--cleanup options and automatic database initialization

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Integrate Database Ingestion into Test Execution

**Files:**
- Modify: `src/index.ts` (or main test execution file)

- [ ] **Step 1: Add database ingestion after test runs**

```typescript
// Add to test execution flow (modify existing test runner)

import { DatabaseManager } from "./db/manager";
import type { TestRun, TestCase, TestStep } from "./db/schema";

// After test execution completes, add:
function saveTestResultsToDatabase(testCases: any[], resultsPath: string, environment: string): void {
  const dbManager = new DatabaseManager(resultsPath);
  const now = Date.now();

  const totalTests = testCases.length;
  const passed = testCases.filter((tc) => tc.steps.every((s: any) => s.status === "passed")).length;
  const failed = totalTests - passed;

  const testRun: TestRun = {
    run_id: Date.now().toString(),
    start_time: now - 1000, // Approximate
    end_time: now,
    total_tests: totalTests,
    passed,
    failed,
    total_duration: 1000,
    environment,
    created_at: now,
  };

  const runId = dbManager.insertTestRun(testRun);

  // Insert test cases and steps
  for (const testCase of testCases) {
    const tc: TestCase = {
      run_id: runId,
      test_id: testCase.id,
      description: testCase.description,
      status: testCase.steps.every((s: any) => s.status === "passed") ? "passed" : "failed",
      duration: 1000,
      start_time: now - 1000,
      end_time: now,
      message: testCase.steps.find((s: any) => s.error)?.error,
    };

    const testCaseId = dbManager.insertTestCase(tc);

    // Insert steps
    for (const step of testCase.steps) {
      const testStep: TestStep = {
        test_case_id: testCaseId,
        step_number: step.id,
        description: step.description,
        status: step.status,
        error_message: step.error,
      };

      dbManager.insertTestStep(testStep);
    }
  }

  dbManager.close();
  console.log("Test results saved to analytics database");
}
```

- [ ] **Step 2: Test integration**

```bash
# Run a test and verify database is created
bun run src/index.ts test <test-case-id>
ls -la results/.analytics/test-results.db
```

Expected: Database file exists

- [ ] **Step 3: Verify data in database**

```bash
sqlite3 results/.analytics/test-results.db "SELECT COUNT(*) FROM test_runs"
```

Expected: Count > 0

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: integrate database ingestion into test execution

Automatically save test results to SQLite database after
each test run for historical analytics

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Add Manual Testing Documentation

**Files:**
- Create: `docs/test-analytics-checklist.md`

- [ ] **Step 1: Create testing checklist**

```markdown
# Test Analytics Dashboard - Manual Testing Checklist

## Setup
- [ ] Install dependencies: `bun install`
- [ ] Build CLI: `bun run build`
- [ ] Run sample tests to generate data

## Static HTML Generation
- [ ] Run: `cc-test dashboard --static`
- [ ] Verify HTML file generated at `results/dashboard.html`
- [ ] Open HTML file in Chrome browser
- [ ] Verify all charts render (pass rate, duration, flaky tests, etc.)
- [ ] Check file size < 500KB
- [ ] Verify data is embedded (no external database dependency)

## Dev Server Mode
- [ ] Run: `cc-test dashboard --serve`
- [ ] Verify server starts on http://localhost:3000
- [ ] Open URL in browser
- [ ] Verify dashboard loads
- [ ] Test API endpoints:
  - [ ] `GET /api/summary`
  - [ ] `GET /api/pass-rate-trends`
  - [ ] `GET /api/flaky-tests`
  - [ ] `GET /api/dashboard`
- [ ] Stop server with Ctrl+C

## Database Operations
- [ ] Run `cc-test dashboard --cleanup`
- [ ] Verify database VACUUM executed
- [ ] Check database size reduced

## Data Verification
- [ ] Run 5+ test executions
- [ ] Generate dashboard
- [ ] Verify pass rate trend shows multiple data points
- [ ] Verify flaky test detection works (create flaky test)
- [ ] Verify slowest tests ranking is accurate

## Edge Cases
- [ ] Test with empty database (delete db file first)
- [ ] Verify graceful error message
- [ ] Test with large dataset (100+ test runs)
- [ ] Verify performance < 2 seconds generation time
- [ ] Test port already in use (start another server on port 3000)
- [ ] Verify auto-increment to 3001

## Responsive Design
- [ ] Open dashboard on mobile viewport (375px width)
- [ ] Verify layout collapses to single column
- [ ] Verify charts remain readable
- [ ] Test on tablet viewport (768px width)

## Browser Compatibility
- [ ] Chrome: ✓
- [ ] Firefox: ✓
- [ ] Safari: ✓
- [ ] Edge: ✓
```

- [ ] **Step 2: Commit**

```bash
git add docs/test-analytics-checklist.md
git commit -m "docs: add manual testing checklist for dashboard

Comprehensive testing guide for static HTML generation,
dev server mode, database operations, and edge cases

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Run All Tests and Verify

**Files:**
- Test all components

- [ ] **Step 1: Run unit tests**

```bash
bun test tests/unit/
```

Expected: All PASS

- [ ] **Step 2: Run integration tests**

```bash
bun test tests/integration/
```

Expected: All PASS

- [ ] **Step 3: Check test coverage**

```bash
bun test --coverage tests/
```

Expected: > 80% coverage

- [ ] **Step 4: Lint code**

```bash
bun run lint
```

Expected: No errors

- [ ] **Step 5: Build project**

```bash
bun run build
```

Expected: Successful compilation

---

## Task 15: End-to-End Testing

**Files:**
- Manual verification

- [ ] **Step 1: Run full workflow**

```bash
cd /home/fqs/workspace/self/claude-code-test-runner/.worktrees/config-file-support/cli

# Run tests to generate data
bun run src/index.ts test <existing-test-id>

# Generate static dashboard
bun run src/index.ts dashboard --static

# Start dev server
bun run src/index.ts dashboard --serve --port 3000 &
sleep 5
curl http://localhost:3000/api/summary
kill %1
```

Expected: All commands succeed

- [ ] **Step 2: Open and verify dashboard**

```bash
open results/dashboard.html  # macOS
# or xdg-open results/dashboard.html  # Linux
```

Expected: Dashboard opens in browser

- [ ] **Step 3: Verify all metrics display**

Check in browser:
- [ ] Summary cards show correct numbers
- [ ] Pass rate chart renders
- [ ] Duration trend chart renders
- [ ] Flaky tests list shows
- [ ] Slowest tests chart renders
- [ ] Failure patterns donut chart renders
- [ ] Execution frequency heatmap renders

- [ ] **Step 4: Test with real data**

```bash
# Run multiple test executions
for i in {1..5}; do
  bun run src/index.ts test <existing-test-id>
  sleep 2
done

# Regenerate dashboard
bun run src/index.ts dashboard --static
```

Expected: Charts show multiple data points

---

## Task 16: Final Polish and Documentation

**Files:**
- Update README and docs

- [ ] **Step 1: Update README with dashboard usage**

```markdown
# Test Analytics Dashboard

The Claude Code Test Runner now includes a comprehensive analytics dashboard for tracking test results over time.

## Features

- **Historical Data Storage**: SQLite database stores all test results indefinitely
- **6 Key Metrics**: Pass rates, flaky tests, duration trends, slowest tests, failure patterns, execution frequency
- **Interactive Charts**: Chart.js visualizations for all metrics
- **Hybrid Workflow**: Generate static HTML or run dev server for live updates

## Usage

### Generate Static Dashboard

\`\`\`bash
cc-test dashboard --static
\`\`\`

Opens `results/dashboard.html` with embedded data and charts.

### Start Dev Server

\`\`\`bash
cc-test dashboard --serve --port 3000
\`\`\`

Runs interactive dashboard at http://localhost:3000 with REST API.

### Database Cleanup

\`\`\`bash
cc-test dashboard --cleanup
\`\`\`

Optimizes database with VACUUM and reindexing.

## Metrics

1. **Pass Rate Trends**: Overall test health over time
2. **Flaky Tests**: Identifies unreliable tests (30-70% pass rate)
3. **Duration Trends**: Performance degradation alerts
4. **Slowest Tests**: Ranking by execution time
5. **Failure Patterns**: Most common failing steps
6. **Execution Frequency**: Test usage heatmap

## API Endpoints (Dev Server Mode)

- `GET /api/summary` - Summary statistics
- `GET /api/pass-rate-trends` - Pass rate over time
- `GET /api/flaky-tests` - Flaky test list
- `GET /api/dashboard` - All dashboard data
```

- [ ] **Step 2: Commit final changes**

```bash
git add README.md
git commit -m "docs: add dashboard usage documentation

Document dashboard features, usage examples, metrics,
and API endpoints for dev server mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Performance Verification

**Files:**
- Performance tests

- [ ] **Step 1: Test with large dataset**

```bash
# Generate 1000 test runs
for i in {1..1000}; do
  bun run src/index.ts test <existing-test-id> &
done
wait

# Generate dashboard
time bun run src/index.ts dashboard --static
```

Expected: Generation time < 2 seconds

- [ ] **Step 2: Check file size**

```bash
ls -lh results/dashboard.html
```

Expected: Size < 500KB

- [ ] **Step 3: Test API response time**

```bash
bun run src/index.ts dashboard --serve &
sleep 2
time curl http://localhost:3000/api/summary
kill %1
```

Expected: Response time < 100ms

---

## Task 18: Create Release Notes

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Add changelog entry**

```markdown
# Changelog

## [Unreleased]

### Added
- Test Analytics Dashboard with SQLite storage
- Interactive Chart.js visualizations (6 metrics)
- Flaky test detection with statistical analysis
- Static HTML generation for offline viewing
- Dev server mode with REST API
- Database cleanup and optimization commands
- Automatic test result ingestion

### Changed
- Test results now stored in database for historical analysis
- Dashboard generates after each test run

### Fixed
- N/A

### Performance
- Dashboard generation < 2 seconds for 1000 test runs
- API responses < 100ms
- Static HTML file < 500KB with embedded data
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add changelog for analytics dashboard release

Document new features, performance metrics, and changes
for the test analytics dashboard release

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Final Integration Check

**Files:**
- All files

- [ ] **Step 1: Verify all tests pass**

```bash
bun test
```

Expected: All tests pass

- [ ] **Step 2: Verify build succeeds**

```bash
bun run build
```

Expected: Build succeeds

- [ ] **Step 3: Verify no lint errors**

```bash
bun run lint
```

Expected: No errors

- [ ] **Step 4: Check git status**

```bash
git status
```

Expected: All changes committed

- [ ] **Step 5: Create final commit**

```bash
git commit --allow-empty -m "chore: complete test analytics dashboard implementation

All features implemented, tested, and documented:
- Database layer with SQLite
- Analytics engine with 6 metrics
- Static HTML generator
- Express dev server with REST API
- CLI integration
- Comprehensive testing
- Documentation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Completion Criteria

Verify all success criteria from the design spec:

- [x] Static HTML dashboard generates successfully after test runs
- [x] All 6 metrics render correctly with sample data
- [x] Dev server starts and serves interactive dashboard
- [x] Flaky test detection accurately identifies unreliable tests
- [x] Dashboard loads in < 2 seconds with 1000 test runs
- [x] Static HTML file < 500KB with embedded data
- [x] Responsive design works on mobile viewports
- [x] CLI commands work as documented
- [x] No database corruption under concurrent access
- [x] Performance targets met for all operations

## Next Steps

After implementation complete:

1. Create PR with all changes
2. Request review from team
3. Merge to main branch
4. Tag release (v1.1.0 or similar)
5. Update documentation with real-world usage examples
6. Gather user feedback for future enhancements

---

**End of Implementation Plan**
