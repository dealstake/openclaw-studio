import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveUserPath } from "@/lib/clawdbot/paths";

export type PathAutocompleteEntry = {
  name: string;
  fullPath: string;
  displayPath: string;
  isDirectory: boolean;
};

export type PathAutocompleteResult = {
  query: string;
  directory: string;
  entries: PathAutocompleteEntry[];
};

export type PathAutocompleteOptions = {
  query: string;
  maxResults?: number;
  homedir?: () => string;
};

export const normalizeQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Query is required.");
  }
  if (trimmed === "~") {
    return "~/";
  }
  if (trimmed.startsWith("~")) {
    return trimmed;
  }
  const withoutLeading = trimmed.replace(/^[\\/]+/, "");
  return `~/${withoutLeading}`;
};

export const isWithinHome = (target: string, home: string): boolean => {
  const relative = path.relative(home, target);
  if (!relative) return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

export const listPathAutocompleteEntries = ({
  query,
  maxResults = 10,
  homedir = os.homedir,
}: PathAutocompleteOptions): PathAutocompleteResult => {
  const normalized = normalizeQuery(query);
  const resolvedHome = path.resolve(homedir());
  const resolvedQuery = resolveUserPath(normalized, homedir);
  if (!isWithinHome(resolvedQuery, resolvedHome)) {
    throw new Error("Path must stay within the home directory.");
  }

  const endsWithSlash =
    normalized.endsWith("/") || normalized.endsWith(path.sep);
  const directoryPath = endsWithSlash
    ? resolvedQuery
    : path.dirname(resolvedQuery);
  const prefix = endsWithSlash ? "" : path.basename(resolvedQuery);

  if (!isWithinHome(directoryPath, resolvedHome)) {
    throw new Error("Path must stay within the home directory.");
  }
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Directory does not exist: ${directoryPath}`);
  }
  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${directoryPath}`);
  }

  const limit =
    Number.isFinite(maxResults) && maxResults > 0
      ? Math.floor(maxResults)
      : 10;

  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.name.startsWith(prefix))
    .map((entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      const relative = path.relative(resolvedHome, fullPath);
      const normalizedRelative = relative.split(path.sep).join("/");
      const displayBase = `~/${normalizedRelative}`;
      return {
        name: entry.name,
        fullPath,
        displayPath: entry.isDirectory() ? `${displayBase}/` : displayBase,
        isDirectory: entry.isDirectory(),
      } satisfies PathAutocompleteEntry;
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);

  return { query: normalized, directory: directoryPath, entries };
};
