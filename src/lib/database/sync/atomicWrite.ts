import fs from "node:fs";
import path from "node:path";

/**
 * Write a file atomically by writing to a temp file first, then renaming.
 * Prevents partial writes from corrupting the target file during concurrent access.
 *
 * On the same filesystem, `fs.renameSync` is atomic on POSIX systems.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const resolved = path.resolve(filePath);
  const tmpPath = `${resolved}.${process.pid}.${Date.now()}.tmp`;

  // Ensure parent directory exists
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(tmpPath, content, "utf-8");

  try {
    fs.renameSync(tmpPath, resolved);
  } catch (err) {
    // Clean up temp file on rename failure
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup
    }
    throw err;
  }
}
