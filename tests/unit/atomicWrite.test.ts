import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { atomicWriteFileSync } from "@/lib/database/sync/atomicWrite";

const TEST_DIR = path.join(os.tmpdir(), "atomic-write-test");

afterEach(() => {
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

describe("atomicWriteFileSync", () => {
  it("writes content to the target file", () => {
    const filePath = path.join(TEST_DIR, "test.json");
    atomicWriteFileSync(filePath, '{"key":"value"}');
    expect(fs.readFileSync(filePath, "utf-8")).toBe('{"key":"value"}');
  });

  it("creates parent directories if needed", () => {
    const filePath = path.join(TEST_DIR, "nested", "deep", "file.txt");
    atomicWriteFileSync(filePath, "hello");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("hello");
  });

  it("overwrites existing file", () => {
    const filePath = path.join(TEST_DIR, "overwrite.txt");
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(filePath, "old", "utf-8");
    atomicWriteFileSync(filePath, "new");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("new");
  });

  it("does not leave .tmp file after success", () => {
    const filePath = path.join(TEST_DIR, "clean.txt");
    atomicWriteFileSync(filePath, "data");
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
  });

  it("handles empty content", () => {
    const filePath = path.join(TEST_DIR, "empty.txt");
    atomicWriteFileSync(filePath, "");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("");
  });
});
