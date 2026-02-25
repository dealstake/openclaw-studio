import { describe, it, expect } from "vitest";

import { coerceBrSingleRecord } from "@/lib/task-control-plane/br-runner";

describe("coerceBrSingleRecord", () => {
  it("returns object directly when given an object", () => {
    const input = { id: "TASK-1", title: "Hello" };
    const result = coerceBrSingleRecord(input, { command: "show", id: "TASK-1" });
    expect(result).toEqual(input);
  });

  it("unwraps first element from array", () => {
    const input = [{ id: "TASK-1" }, { id: "TASK-2" }];
    const result = coerceBrSingleRecord(input, { command: "show", id: "TASK-1" });
    expect(result).toEqual({ id: "TASK-1" });
  });

  it("throws for null input", () => {
    expect(() => coerceBrSingleRecord(null, { command: "show", id: "X" })).toThrow(
      "Unexpected br show --json output for X.",
    );
  });

  it("throws for empty array", () => {
    expect(() => coerceBrSingleRecord([], { command: "update", id: "Y" })).toThrow(
      "Unexpected br update --json output for Y.",
    );
  });

  it("throws for string input", () => {
    expect(() => coerceBrSingleRecord("string", { command: "show", id: "Z" })).toThrow();
  });

  it("throws for number input", () => {
    expect(() => coerceBrSingleRecord(42, { command: "show", id: "Z" })).toThrow();
  });
});
