"use client";

import { memo, useCallback } from "react";
import { FileSearch, X } from "lucide-react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { SearchInput } from "@/components/SearchInput";
import { Skeleton } from "@/components/Skeleton";
import { PanelIconButton } from "@/components/PanelIconButton";

import { useMemorySearch } from "../hooks/useMemorySearch";
import type { MemorySearchResult } from "../hooks/useMemorySearch";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap all occurrences of `query` in `text` with <mark> tags. */
function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(lowerQ, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-sm bg-yellow-300/40 px-0.5 text-foreground dark:bg-yellow-400/30"
      >
        {text.slice(idx, idx + lowerQ.length)}
      </mark>
    );
    cursor = idx + lowerQ.length;
  }
  return <>{parts}</>;
}

/** Format `memory/2026-02-27.md` → `2026-02-27` for cleaner badge labels. */
function formatFileBadge(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/, "");
}

// ── Result Card ───────────────────────────────────────────────────────────────

type ResultCardProps = {
  result: MemorySearchResult;
  query: string;
  onClick: () => void;
};

const ResultCard = memo(function ResultCard({
  result,
  query,
  onClick,
}: ResultCardProps) {
  const badge = formatFileBadge(result.filePath);
  const isMemoryDir = result.filePath.startsWith("memory/");

  return (
    <button
      type="button"
      className="group w-full rounded-md border border-border/60 bg-card/70 p-2 text-left transition hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={onClick}
      aria-label={`Open ${result.filePath} at line ${result.lineNumber}`}
    >
      {/* Header row */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
            isMemoryDir
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {badge}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Line {result.lineNumber}
          {result.matchCount > 1 ? ` · ${result.matchCount} matches` : ""}
        </span>
      </div>

      {/* Snippet */}
      <pre className="overflow-hidden text-ellipsis whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground/80">
        {highlightQuery(result.snippet, query)}
      </pre>
    </button>
  );
});

// ── Loading Skeletons ─────────────────────────────────────────────────────────

function SearchSkeletons() {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {[72, 56, 64].map((h) => (
        <Skeleton key={h} className={`h-${h === 72 ? "16" : h === 56 ? "12" : "14"} w-full`} />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type MemorySearchViewProps = {
  agentId: string;
  onOpenFile: (path: string, line?: number) => void;
  onClose: () => void;
};

/**
 * Full memory search panel.
 * Renders a search input and result cards with match highlighting.
 * Replaces the file tree when search mode is active in WorkspaceExplorerPanel.
 */
export const MemorySearchView = memo(function MemorySearchView({
  agentId,
  onOpenFile,
  onClose,
}: MemorySearchViewProps) {
  const { query, setQuery, results, searching, error, totalMatches, filesSearched } =
    useMemorySearch(agentId);

  const handleResultClick = useCallback(
    (result: MemorySearchResult) => {
      onOpenFile(result.filePath, result.lineNumber);
    },
    [onOpenFile]
  );

  const handleClear = useCallback(() => setQuery(""), [setQuery]);

  const showEmpty = !searching && !error && query.trim() && results.length === 0;
  const showResults = !searching && !error && results.length > 0;
  const showIdle = !query.trim() && !searching;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={handleClear}
            placeholder="Search memory files…"
            aria-label="Search memory files"
            variant="compact"
          />
        </div>
        <PanelIconButton onClick={onClose} aria-label="Close search">
          <X className="h-3.5 w-3.5" />
        </PanelIconButton>
      </div>

      {/* ── Body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Idle state — no query yet */}
        {showIdle && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FileSearch className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Search across memory files
            </p>
          </div>
        )}

        {/* Loading */}
        {searching && <SearchSkeletons />}

        {/* Error */}
        {error && !searching && (
          <ErrorBanner
            message={error}
            className="mx-3 mt-3"
          />
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FileSearch className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No matches found</p>
            <p className="text-[10px] text-muted-foreground">
              Try a different search term
            </p>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="flex flex-col gap-1.5 px-2 py-2">
            {/* Summary line */}
            <p className="px-1 text-[10px] text-muted-foreground">
              {totalMatches} match{totalMatches !== 1 ? "es" : ""} in{" "}
              {filesSearched} file{filesSearched !== 1 ? "s" : ""}
            </p>

            {results.map((result, idx) => (
              <ResultCard
                key={`${result.filePath}:${result.lineNumber}:${idx}`}
                result={result}
                query={query}
                onClick={() => handleResultClick(result)}
              />
            ))}

            {results.length >= 50 && (
              <p className="px-1 pt-1 text-center text-[10px] text-muted-foreground">
                Showing first 50 results — refine your query for fewer matches
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
