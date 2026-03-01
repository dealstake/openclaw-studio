import { describe, it, expect, vi } from "vitest";
import {
  runDeleteAgentTransaction,
  type DeleteAgentTransactionDeps,
} from "@/features/agents/operations/deleteAgentTransaction";

const makeDeps = (overrides?: Partial<DeleteAgentTransactionDeps>): DeleteAgentTransactionDeps => ({
  trashAgentState: vi.fn().mockResolvedValue({ trashDir: "/tmp/trash", moved: [{ from: "a", to: "b" }] }),
  restoreAgentState: vi.fn().mockResolvedValue({ restored: [{ from: "b", to: "a" }] }),
  removeCronJobsForAgent: vi.fn().mockResolvedValue(undefined),
  deleteGatewayAgent: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn(),
  ...overrides,
});

describe("runDeleteAgentTransaction", () => {
  it("throws for empty agent id", async () => {
    const deps = makeDeps();
    await expect(runDeleteAgentTransaction(deps, "")).rejects.toThrow("Agent id is required");
    await expect(runDeleteAgentTransaction(deps, "   ")).rejects.toThrow("Agent id is required");
  });

  it("runs full success path: trash → remove cron → delete gateway", async () => {
    const deps = makeDeps();
    const result = await runDeleteAgentTransaction(deps, "agent-1");

    expect(deps.trashAgentState).toHaveBeenCalledWith("agent-1");
    expect(deps.removeCronJobsForAgent).toHaveBeenCalledWith("agent-1");
    expect(deps.deleteGatewayAgent).toHaveBeenCalledWith("agent-1");
    expect(result.trashed.trashDir).toBe("/tmp/trash");
    expect(result.restored).toBeNull();
    expect(deps.restoreAgentState).not.toHaveBeenCalled();
  });

  it("rolls back (restores) when removeCronJobsForAgent fails", async () => {
    const error = new Error("cron delete failed");
    const deps = makeDeps({
      removeCronJobsForAgent: vi.fn().mockRejectedValue(error),
    });

    await expect(runDeleteAgentTransaction(deps, "agent-1")).rejects.toThrow("cron delete failed");
    expect(deps.restoreAgentState).toHaveBeenCalledWith("agent-1", "/tmp/trash");
  });

  it("rolls back when deleteGatewayAgent fails", async () => {
    const error = new Error("gateway delete failed");
    const deps = makeDeps({
      deleteGatewayAgent: vi.fn().mockRejectedValue(error),
    });

    await expect(runDeleteAgentTransaction(deps, "agent-1")).rejects.toThrow("gateway delete failed");
    expect(deps.restoreAgentState).toHaveBeenCalledWith("agent-1", "/tmp/trash");
  });

  it("throws AggregateError with both errors when restore also fails", async () => {
    const gwErr = new Error("gw fail");
    const restoreErr = new Error("restore fail");
    const deps = makeDeps({
      deleteGatewayAgent: vi.fn().mockRejectedValue(gwErr),
      restoreAgentState: vi.fn().mockRejectedValue(restoreErr),
    });

    const thrown = await runDeleteAgentTransaction(deps, "agent-1").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(AggregateError);
    const agg = thrown as AggregateError;
    expect(agg.errors).toContain(gwErr);
    expect(agg.errors).toContain(restoreErr);
    expect(agg.message).toMatch(/corrupted/i);
    expect(deps.logError).toHaveBeenCalledWith(
      expect.stringContaining("corrupted"),
      restoreErr
    );
  });

  it("skips restore when no files were moved", async () => {
    const deps = makeDeps({
      trashAgentState: vi.fn().mockResolvedValue({ trashDir: "/tmp/trash", moved: [] }),
      deleteGatewayAgent: vi.fn().mockRejectedValue(new Error("fail")),
    });

    await expect(runDeleteAgentTransaction(deps, "agent-1")).rejects.toThrow("fail");
    expect(deps.restoreAgentState).not.toHaveBeenCalled();
  });

  it("trims agent id whitespace", async () => {
    const deps = makeDeps();
    await runDeleteAgentTransaction(deps, "  agent-1  ");
    expect(deps.trashAgentState).toHaveBeenCalledWith("agent-1");
  });
});
