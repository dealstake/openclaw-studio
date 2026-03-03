import { describe, it, expect, vi } from "vitest";
import { atomicCreate, type AtomicStep } from "@/lib/workspace/atomicCreate";

describe("atomicCreate", () => {
  it("executes all steps on success", async () => {
    const order: string[] = [];
    const steps: AtomicStep[] = [
      { name: "A", execute: async () => { order.push("A"); } },
      { name: "B", execute: async () => { order.push("B"); } },
      { name: "C", execute: async () => { order.push("C"); } },
    ];
    const result = await atomicCreate(steps);
    expect(result.success).toBe(true);
    expect(order).toEqual(["A", "B", "C"]);
  });

  it("rolls back completed steps on failure (reverse order)", async () => {
    const order: string[] = [];
    const steps: AtomicStep[] = [
      {
        name: "A",
        execute: async () => { order.push("exec-A"); },
        rollback: async () => { order.push("rollback-A"); },
      },
      {
        name: "B",
        execute: async () => { order.push("exec-B"); },
        rollback: async () => { order.push("rollback-B"); },
      },
      {
        name: "C",
        execute: async () => { throw new Error("C failed"); },
        rollback: async () => { order.push("rollback-C"); },
      },
    ];
    const result = await atomicCreate(steps);
    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("C");
    expect(result.error).toBe("C failed");
    // C's rollback should NOT be called (it never completed)
    // B then A should be rolled back in reverse
    expect(order).toEqual(["exec-A", "exec-B", "rollback-B", "rollback-A"]);
  });

  it("reports rollback errors without throwing", async () => {
    const steps: AtomicStep[] = [
      {
        name: "A",
        execute: async () => {},
        rollback: async () => { throw new Error("rollback-A failed"); },
      },
      {
        name: "B",
        execute: async () => { throw new Error("B failed"); },
      },
    ];
    const result = await atomicCreate(steps);
    expect(result.success).toBe(false);
    expect(result.rollbackErrors).toEqual(["A: rollback-A failed"]);
  });

  it("handles empty steps array", async () => {
    const result = await atomicCreate([]);
    expect(result.success).toBe(true);
  });

  it("first step failure triggers no rollbacks", async () => {
    const rollbackSpy = vi.fn();
    const steps: AtomicStep[] = [
      {
        name: "A",
        execute: async () => { throw new Error("immediate fail"); },
        rollback: rollbackSpy,
      },
    ];
    const result = await atomicCreate(steps);
    expect(result.success).toBe(false);
    expect(rollbackSpy).not.toHaveBeenCalled();
  });
});
