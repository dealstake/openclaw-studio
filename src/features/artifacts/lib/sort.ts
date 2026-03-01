import type { DriveFile, SortDirection } from "../types";

/** Sort files by modified time. Falls back to 0 for invalid dates. */
export function sortFiles(files: DriveFile[], dir: SortDirection): DriveFile[] {
  return [...files].sort((a, b) => {
    const ta = new Date(a.modifiedTime).getTime() || 0;
    const tb = new Date(b.modifiedTime).getTime() || 0;
    return dir === "newest" ? tb - ta : ta - tb;
  });
}
