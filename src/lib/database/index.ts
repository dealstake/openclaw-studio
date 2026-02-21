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
let _migrationsChecked = false;

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

    try {
      _sqlite = new Database(resolvedPath);
      _sqlite.pragma("journal_mode = WAL");
      _sqlite.pragma("foreign_keys = ON");
    } catch (err) {
      // Corrupt DB file — delete and retry once
      if (resolvedPath !== ":memory:" && fs.existsSync(resolvedPath)) {
        if (process.env.NODE_ENV !== "test") {
          console.error(`[studio-db] Corrupt database file, recreating: ${resolvedPath}`, err);
        }
        // Close the handle if it was opened
        try { _sqlite?.close(); } catch { /* ignore */ }
        _sqlite = null;
        fs.unlinkSync(resolvedPath);
        // Also remove WAL/SHM files if present
        for (const suffix of ["-wal", "-shm"]) {
          const f = resolvedPath + suffix;
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
        _sqlite = new Database(resolvedPath);
        _sqlite.pragma("journal_mode = WAL");
        _sqlite.pragma("foreign_keys = ON");
      } else {
        throw err;
      }
    }

    _db = drizzle(_sqlite, { schema });
  }

  // Check for pending migrations — skip filesystem scan after first successful check
  if (!_migrationsChecked) {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    const migrationFiles = fs.readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql"));
    if (migrationFiles.length > _migrationCount) {
      const prevCount = _migrationCount;
      migrate(_db, { migrationsFolder });
      _migrationCount = migrationFiles.length;

      // Log migration activity (skip in test env)
      if (process.env.NODE_ENV !== "test") {
        if (prevCount === 0) {
          console.warn(`[studio-db] Applied ${_migrationCount} migration(s)`);
        } else {
          console.warn(`[studio-db] Applied ${_migrationCount - prevCount} new migration(s) (${prevCount} → ${_migrationCount})`);
        }

        // Diagnostic: warn if any data table is empty
        const emptyTables: string[] = [];
        for (const table of ["projects_index", "tasks", "activity_events", "project_details"]) {
          try {
            const rows = _sqlite!.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number } | undefined;
            if (rows && rows.c === 0) emptyTables.push(table);
          } catch {
            emptyTables.push(`${table} (missing)`);
          }
        }
        if (emptyTables.length > 0) {
          console.warn(`[studio-db] Empty tables after migration: ${emptyTables.join(", ")} — auto-import will populate on first API request`);
        }
      }
    } else {
      // No new migrations — mark as checked to skip future readdirSync calls
      _migrationsChecked = true;
    }
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
  _migrationsChecked = false;
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
