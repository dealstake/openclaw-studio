import type { DriveFile, SortDirection } from "../types";

/** Sort files by modified time. */
export function sortFiles(files: DriveFile[], dir: SortDirection): DriveFile[] {
  return [...files].sort((a, b) => {
    const ta = new Date(a.modifiedTime).getTime();
    const tb = new Date(b.modifiedTime).getTime();
    return dir === "newest" ? tb - ta : ta - tb;
  });
}
