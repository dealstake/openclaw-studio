"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, FileSearch, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  rowid: number;
  sourceId: number;
  chunkIndex: number;
  content: string;
  rank: number;
  snippet: string;
  sourceType: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_TYPE_COLORS: Record<string, string> = {
  web: "text-blue-500",
  file: "text-amber-500",
  manual: "text-emerald-500",
  knowledge_dir: "text-violet-500",
};

interface TextSegment {
  bold: boolean;
  text: string;
}

/**
 * Parse FTS5 snippet() output into plain segments. The sidecar wraps matching
 * terms in `<b>...</b>`. Extracted as a module-level utility (not inside the
 * component) to avoid mutation inside a render-phase .map() callback.
 */
function parseHighlightSegments(raw: string): TextSegment[] {
  const parts = raw.split(/(<b>|<\/b>)/);
  const segments: TextSegment[] = [];
  let bold = false;
  for (const part of parts) {
    if (part === "<b>") {
      bold = true;
    } else if (part === "</b>") {
      bold = false;
    } else if (part) {
      segments.push({ bold, text: part });
    }
  }
  return segments;
}

/**
 * Render FTS5 snippet() output safely. Avoids dangerouslySetInnerHTML by
 * pre-parsing the `<b>` markers into segments outside the .map() callback.
 */
function HighlightedSnippet({ text }: { text: string }) {
  const segments = parseHighlightSegments(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

// ─── ResultCard ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  result: SearchResult;
  rank: number;
}

const ResultCard = React.memo(function ResultCard({ result, rank }: ResultCardProps) {
  const color =
    SOURCE_TYPE_COLORS[result.sourceType] ?? "text-muted-foreground";
  const hasSnippet = !!result.snippet;
  const displayText = hasSnippet
    ? result.snippet
    : result.content.slice(0, 300);

  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            color,
          )}
        >
          {result.sourceType}
        </span>
        <span className="text-[10px] text-muted-foreground/40">
          chunk {result.chunkIndex + 1}
        </span>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground/40">
          #{rank}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">
        {hasSnippet ? (
          <HighlightedSnippet text={displayText} />
        ) : (
          displayText
        )}
      </p>
    </div>
  );
});

// ─── KnowledgeSearchPreview ──────────────────────────────────────────────────

export interface KnowledgeSearchPreviewProps {
  agentId: string | null;
  personaId: string;
  status: GatewayStatus;
}

/**
 * Interactive search preview that lets users test what the persona would
 * retrieve for any query. Queries the FTS5 index via the search API and
 * renders highlighted result snippets with source type labels.
 */
export const KnowledgeSearchPreview = React.memo(
  function KnowledgeSearchPreview({
    agentId,
    personaId,
    status,
  }: KnowledgeSearchPreviewProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const doSearch = useCallback(
      async (q: string) => {
        if (!agentId || !q.trim() || status !== "connected") return;
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({
            agentId,
            personaId,
            q: q.trim(),
            limit: "8",
          });
          const res = await fetch(
            `/api/workspace/knowledge/search?${params.toString()}`,
          );
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results ?? []);
          setHasSearched(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed.");
        } finally {
          setLoading(false);
        }
      },
      [agentId, personaId, status],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!val.trim()) {
          setResults([]);
          setHasSearched(false);
          setError(null);
          return;
        }
        debounceRef.current = setTimeout(() => {
          void doSearch(val);
        }, 400);
      },
      [doSearch],
    );

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    return (
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-muted-foreground/70">
          Preview what the persona would retrieve for any query. Results come
          from the FTS5 index.
        </p>

        {/* Search input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Type a question or keyword…"
            disabled={status !== "connected"}
            aria-label="Knowledge search preview query"
            className={cn(
              "min-h-[44px] w-full rounded-md border border-border/40 bg-background/50 pl-9 pr-9 md:min-h-9",
              "text-sm text-foreground placeholder:text-muted-foreground/70",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              "disabled:opacity-50",
            )}
          />
          {loading && (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/50" />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* No results */}
        {!loading && hasSearched && results.length === 0 && !error && (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <FileSearch className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No results found</p>
            <p className="text-[11px] text-muted-foreground/70">
              Try different keywords or add more knowledge sources
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
              {results.length} chunk{results.length !== 1 ? "s" : ""} retrieved
            </p>
            {results.map((result, i) => (
              <ResultCard key={result.rowid} result={result} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Initial state */}
        {!hasSearched && !loading && (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <Search className="h-6 w-6 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/60">
              Enter a query to preview search results
            </p>
          </div>
        )}
      </div>
    );
  },
);
