import { describe, it, expect } from "vitest";
import { sortFiles } from "@/features/artifacts/lib/sort";
import type { DriveFile } from "@/features/artifacts/types";

const files: DriveFile[] = [
  { id: "a", name: "Old", mimeType: "text/plain", modifiedTime: "2026-01-01T00:00:00Z" },
  { id: "b", name: "New", mimeType: "text/plain", modifiedTime: "2026-02-01T00:00:00Z" },
  { id: "c", name: "Mid", mimeType: "text/plain", modifiedTime: "2026-01-15T00:00:00Z" },
];

describe("sortFiles", () => {
  it("sorts newest first", () => {
    const result = sortFiles(files, "newest");
    expect(result.map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts oldest first", () => {
    const result = sortFiles(files, "oldest");
    expect(result.map((f) => f.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the original array", () => {
    const original = [...files];
    sortFiles(files, "newest");
    expect(files).toEqual(original);
  });
});
