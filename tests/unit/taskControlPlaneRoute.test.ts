import { beforeEach, describe, expect, it, vi } from "vitest";

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { GET } from "@/app/api/task-control-plane/route";
import { buildTaskControlPlaneSnapshot } from "@/lib/task-control-plane/read-model";

const ORIGINAL_ENV = { ...process.env };

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process"
  );
  return {
    default: actual,
    ...actual,
    execFile: vi.fn(),
    spawnSync: vi.fn(),
  };
});

vi.mock("@/lib/task-control-plane/read-model", () => ({
  buildTaskControlPlaneSnapshot: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);
const mockedBuildSnapshot = vi.mocked(buildTaskControlPlaneSnapshot);
const mockedConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

/** Helper to make execFile invoke its callback with given stdout. */
function mockExecFileSuccess(stdout: string) {
  return (_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
    cb(null, stdout, "");
  };
}

function mockExecFileError(stdout: string, stderr = "") {
  return (_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
    const err = Object.assign(new Error("exit 1"), { code: 1 });
    cb(err, stdout, stderr);
  };
}

describe("task control plane route", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPENCLAW_TASK_CONTROL_PLANE_BEADS_DIR;
    delete process.env.OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR;
    delete process.env.OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET;
    delete process.env.OPENCLAW_TASK_CONTROL_PLANE_SSH_USER;
    delete process.env.OPENCLAW_STATE_DIR;
    mockedExecFile.mockReset();
    mockedBuildSnapshot.mockReset();
    mockedConsoleError.mockClear();
  });

  it("returns snapshot on success", async () => {
    const responses = [
      JSON.stringify({ path: "/tmp/.beads" }),
      JSON.stringify([{ id: "bd-1" }]),
      JSON.stringify([{ id: "bd-2" }]),
      JSON.stringify([{ id: "bd-3" }]),
      JSON.stringify([{ id: "bd-4" }]),
    ];
    let callIndex = 0;
    mockedExecFile.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
        cb(null, responses[callIndex++], "");
      }) as never,
    );

    mockedBuildSnapshot.mockReturnValue({
      generatedAt: "2026-02-05T00:00:00.000Z",
      scopePath: "/tmp/.beads",
      columns: { ready: [], inProgress: [], blocked: [], done: [] },
      warnings: [],
    });

    const response = await GET();
    const body = (await response.json()) as { snapshot: unknown };

    expect(response.status).toBe(200);
    expect(body.snapshot).toBeDefined();
    expect(mockedExecFile).toHaveBeenCalledTimes(5);
    expect(mockedBuildSnapshot).toHaveBeenCalledWith({
      scopePath: "/tmp/.beads",
      openIssues: [{ id: "bd-1" }],
      inProgressIssues: [{ id: "bd-2" }],
      blockedIssues: [{ id: "bd-3" }],
      doneIssues: [{ id: "bd-4" }],
    });
  });

  it("runs br from configured beads scope", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-control-plane-"));
    const beadsDir = path.join(tempRoot, ".beads");
    fs.mkdirSync(beadsDir);

    process.env.OPENCLAW_TASK_CONTROL_PLANE_BEADS_DIR = beadsDir;

    const responses = [
      JSON.stringify({ path: beadsDir }),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
    ];
    let callIndex = 0;
    mockedExecFile.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
        cb(null, responses[callIndex++], "");
      }) as never,
    );

    mockedBuildSnapshot.mockReturnValue({
      generatedAt: "2026-02-05T00:00:00.000Z",
      scopePath: beadsDir,
      columns: { ready: [], inProgress: [], blocked: [], done: [] },
      warnings: [],
    });

    await GET();

    expect(mockedExecFile).toHaveBeenCalledTimes(5);
    for (const call of mockedExecFile.mock.calls) {
      const options = call[2] as { cwd?: string };
      expect(options.cwd).toBe(tempRoot);
    }
  });

  it("returns 400 for missing beads workspace", async () => {
    mockedExecFile.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
        const err = Object.assign(new Error("exit 1"), { code: 1 });
        cb(err, JSON.stringify({ error: "no beads directory found" }), "");
      }) as never,
    );

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Beads workspace not initialized");
    expect(mockedConsoleError).toHaveBeenCalled();
  });

  it("returns 502 for other failures", async () => {
    mockedExecFile.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: Function) => {
        const err = Object.assign(new Error("exit 1"), { code: 1 });
        cb(err, JSON.stringify({ error: "boom" }), "");
      }) as never,
    );

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe("boom");
    expect(mockedConsoleError).toHaveBeenCalledWith("boom");
  });
});
