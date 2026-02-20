import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const mocks = {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  };
  return { ...mocks, default: mocks };
});
const mockedFs = vi.mocked(fs);

const mockDbAll = vi.fn();
const mockDb = { all: mockDbAll };
vi.mock("@/lib/database", () => ({ getDb: () => mockDb }));

const mockCheckIntegrity = vi.fn();
vi.mock("@/lib/database/sync/integrityCheck", () => ({
  checkIntegrity: (...args: unknown[]) => mockCheckIntegrity(...args),
}));

vi.mock("@/lib/workspace/resolve", () => ({
  resolveWorkspacePath: (_agentId: string, p: string) => ({ absolute: `/fake/${p}` }),
  isSafeAgentId: (id: string) => /^[a-zA-Z0-9_-]+$/.test(id),
}));

import { GET } from "@/app/api/health/database/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/health/database");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString()) as unknown as Request;
}

/**
 * The route uses drizzle `sql` tagged templates which produce objects with
 * `queryChunks` arrays. We inspect the SQL string representation to route
 * mock responses.
 */
function sqlContains(sqlObj: unknown, text: string): boolean {
  // drizzle sql objects have queryChunks with StringChunk objects containing `value` arrays
  try {
    const str = JSON.stringify(sqlObj);
    return str.toLowerCase().includes(text.toLowerCase());
  } catch {
    return false;
  }
}

function setupHealthyDb(overrides: { tableCounts?: Record<string, number>; appliedMigrations?: number } = {}) {
  const tableCounts = overrides.tableCounts ?? {
    projects_index: 10,
    tasks: 5,
    activity_events: 20,
    project_details: 8,
  };
  const appliedMigrations = overrides.appliedMigrations ?? 3;

  mockDbAll.mockImplementation((query: unknown) => {
    if (sqlContains(query, "sqlite_master")) {
      return Object.keys(tableCounts)
        .filter((t) => tableCounts[t] !== undefined)
        .map((name) => ({ name }));
    }
    // COUNT queries — check which table
    if (sqlContains(query, "COUNT")) {
      for (const [table, count] of Object.entries(tableCounts)) {
        if (sqlContains(query, table)) return [{ c: count }];
      }
      return [{ c: 0 }];
    }
    if (sqlContains(query, "__drizzle_migrations")) {
      return Array.from({ length: appliedMigrations }, (_, i) => ({ id: i + 1 }));
    }
    return [];
  });

  // Migrations folder
  mockedFs.existsSync.mockReturnValue(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedFs.readdirSync.mockReturnValue(["0001.sql", "0002.sql", "0003.sql"] as any);
  mockedFs.readFileSync.mockReturnValue("[]");

  mockCheckIntegrity.mockReturnValue({
    projectsDrift: { dbCount: 10, fileCount: 10, match: true },
    tasksDrift: { dbCount: 5, fileCount: 5, match: true },
    activityDrift: { dbCount: 20, fileCount: 20, match: true },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/health/database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok status when all tables exist and have data", async () => {
    setupHealthyDb();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.tables.projects_index.exists).toBe(true);
    expect(data.tables.tasks.exists).toBe(true);
    expect(data.tables.activity_events.exists).toBe(true);
    expect(data.tables.project_details.exists).toBe(true);
    expect(data.migrations.pending).toBe(0);
    expect(data.errors).toHaveLength(0);
  });

  it("returns error when tables are missing", async () => {
    mockDbAll.mockImplementation((query: unknown) => {
      if (sqlContains(query, "sqlite_master")) return []; // no tables
      if (sqlContains(query, "__drizzle_migrations")) return [];
      return [];
    });
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue("[]");
    mockCheckIntegrity.mockReturnValue({
      projectsDrift: { dbCount: 0, fileCount: 0, match: true },
      tasksDrift: { dbCount: 0, fileCount: 0, match: true },
      activityDrift: { dbCount: 0, fileCount: 0, match: true },
    });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.status).toBe("error");
    expect(data.errors).toContain("Missing table: projects_index");
    expect(data.errors).toContain("Missing table: tasks");
  });

  it("reports pending migrations", async () => {
    setupHealthyDb({ appliedMigrations: 1 });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.migrations.applied).toBe(1);
    expect(data.migrations.available).toBe(3);
    expect(data.migrations.pending).toBe(2);
    expect(data.errors).toContain("2 pending migration(s)");
  });

  it("returns degraded when tables exist but are empty", async () => {
    setupHealthyDb({
      tableCounts: { projects_index: 0, tasks: 0, activity_events: 0, project_details: 0 },
      appliedMigrations: 3,
    });
    mockCheckIntegrity.mockReturnValue({
      projectsDrift: { dbCount: 0, fileCount: 5, match: false },
      tasksDrift: { dbCount: 0, fileCount: 3, match: false },
      activityDrift: { dbCount: 0, fileCount: 10, match: false },
    });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.status).toBe("degraded");
  });

  it("includes drift detection results", async () => {
    setupHealthyDb();
    mockCheckIntegrity.mockReturnValue({
      projectsDrift: { dbCount: 8, fileCount: 10, match: false },
      tasksDrift: { dbCount: 5, fileCount: 5, match: true },
      activityDrift: { dbCount: 20, fileCount: 20, match: true },
    });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.drift.projects.match).toBe(false);
    expect(data.drift.projects.dbCount).toBe(8);
    expect(data.drift.projects.fileCount).toBe(10);
    expect(data.drift.tasks.match).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockDbAll.mockImplementation(() => {
      throw new Error("SQLITE_CANTOPEN");
    });
    mockedFs.readFileSync.mockReturnValue("[]");

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe("error");
    expect(data.errors[0]).toContain("SQLITE_CANTOPEN");
  });
});
