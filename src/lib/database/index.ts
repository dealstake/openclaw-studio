import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudioDb = BetterSQLite3Database<typeof schema>;

// ─── Singleton ───────────────────────────────────────────────────────────────

let _db: StudioDb | null = null;
let _sqlite: Database.Database | null = null;
let _migrationCount: number = 0;

/**
 * Get the singleton database connection. Creates on first call, and
 * re-runs migrations whenever new migration files are detected.
 *
 * @param dbPath — Override path for testing. Defaults to
 *   `~/.openclaw/agents/<agentId>/data/studio.db` resolved from env.
 */
export function getDb(dbPath?: string): StudioDb {
  if (!_db) {
    const resolvedPath = dbPath ?? resolveDefaultDbPath();

    // Ensure parent directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    _sqlite = new Database(resolvedPath);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");

    _db = drizzle(_sqlite, { schema });
  }

  // Always check for pending migrations (idempotent — checks __drizzle_migrations)
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    const migrationFiles = fs.readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql"));
    if (migrationFiles.length > _migrationCount) {
      migrate(_db, { migrationsFolder });
      _migrationCount = migrationFiles.length;
    }
  }

  return _db;
}

/**
 * Close the database connection and reset the singleton.
 * Useful for tests and graceful shutdown.
 */
export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
  }
  _db = null;
  _migrationCount = 0;
}

/**
 * Create an in-memory database for testing. Not a singleton — each call
 * returns a fresh instance.
 */
export function createTestDb(): StudioDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Run migrations from project root
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }

  return db;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function resolveDefaultDbPath(): string {
  // Try OPENCLAW_AGENT_DIR env var first (set by sidecar/gateway)
  const agentDir = process.env.OPENCLAW_AGENT_DIR;
  if (agentDir) {
    return path.join(agentDir, "data", "studio.db");
  }

  // Fallback: ~/.openclaw/agents/alex/data/studio.db
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
  return path.join(home, ".openclaw", "agents", "alex", "data", "studio.db");
}
