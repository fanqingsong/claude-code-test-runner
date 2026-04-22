import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { runMigrations, getDatabasePath } from "../../../src/db/migrations";
import { Database } from "bun:sqlite";

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
