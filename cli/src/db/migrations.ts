import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { SCHEMA_VERSION, CREATE_TABLES_SQL, CREATE_METADATA_TABLE } from "./schema";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db: Database) => {
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
    db.exec("PRAGMA foreign_keys = ON");

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
