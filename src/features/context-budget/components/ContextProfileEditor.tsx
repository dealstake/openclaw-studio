"use client";

/**
 * ContextProfileEditor — per-file context mode controls.
 *
 * Displays each workspace file grouped by budget category, with an inline
 * Always / Auto / Never segmented control. Changes are saved immediately
 * via optimistic updates to `config.agents.list[].contextProfile`.
 *
 * Phase 2: Manual per-file context controls.
 */

import { memo, useCallback } from "react";
import { AlertCircle, RefreshCw, Settings2, FileText } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatTokenEstimate } from "@/lib/text/tokens";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useContextProfile } from "../hooks/useContextProfile";
import { useContextBudget } from "../hooks/useContextBudget";
import {
  BUDGET_CATEGORY_ORDER,
  CATEGORY_META,
  CONTEXT_MODE_DESCRIPTIONS,
  CONTEXT_MODE_LABELS,
  CONTEXT_MODES,
  DEFAULT_CONTEXT_MODE,
  type BudgetCategory,
  type ContextMode,
  type FileBudgetEntry,
  type ContextProfile,
} from "../types";

interface ContextProfileEditorProps {
  /** The agent whose context profile is being edited. */
  agentId: string;
  /** Active gateway client for config.get / config.patch. */
  client: GatewayClient;
  /** Current gateway connection status. */
  status: GatewayStatus;
}

// ── Mode selector ─────────────────────────────────────────────────────────────

interface ModeSelectorProps {
  filePath: string;
  mode: ContextMode;
  disabled: boolean;
  onChange: (filePath: string, mode: ContextMode) => void;
}

const ModeSelector = memo(function ModeSelector({
  filePath,
  mode,
  disabled,
  onChange,
}: ModeSelectorProps) {
  return (
    <div
      className="flex overflow-hidden rounded border border-border/50"
      role="group"
      aria-label={`Context mode for ${filePath}`}
    >
      {CONTEXT_MODES.map((opt) => {
        const isActive = mode === opt;
        const colorClass =
          opt === "always"
            ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
            : opt === "never"
              ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
              : "bg-primary/15 text-primary border-primary/30";
        return (
          <button
            key={opt}
            type="button"
            title={CONTEXT_MODE_DESCRIPTIONS[opt]}
            disabled={disabled}
            className={`border-r border-border/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition last:border-r-0
              ${isActive ? colorClass : "bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"}
              disabled:cursor-not-allowed disabled:opacity-40`}
            onClick={() => onChange(filePath, opt)}
            aria-pressed={isActive}
            aria-label={`${CONTEXT_MODE_LABELS[opt]} — ${CONTEXT_MODE_DESCRIPTIONS[opt]}`}
          >
            {CONTEXT_MODE_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
});

// ── File row ──────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileBudgetEntry;
  mode: ContextMode;
  saving: boolean;
  onModeChange: (filePath: string, mode: ContextMode) => void;
}

const FileRow = memo(function FileRow({ file, mode, saving, onModeChange }: FileRowProps) {
  const isOverridden = mode !== DEFAULT_CONTEXT_MODE;
  return (
    <div
      className={`flex items-center gap-2 py-1.5 pl-8 pr-3 transition ${
        isOverridden ? "bg-muted/20" : ""
      }`}
      data-testid={`context-profile-file-${file.name}`}
    >
      <FileText
        className={`h-3 w-3 flex-shrink-0 ${isOverridden ? "text-foreground/60" : "text-muted-foreground/50"}`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-xs ${isOverridden ? "font-medium text-foreground/80" : "text-muted-foreground"}`}
        title={file.path}
      >
        {file.name}
      </span>
      <span className="text-[9px] text-muted-foreground/50 tabular-nums">
        {formatTokenEstimate(file.tokens)}
      </span>
      <ModeSelector
        filePath={file.path}
        mode={mode}
        disabled={saving}
        onChange={onModeChange}
      />
    </div>
  );
});

// ── Category section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: BudgetCategory;
  files: FileBudgetEntry[];
  profile: ContextProfile;
  saving: boolean;
  onModeChange: (filePath: string, mode: ContextMode) => void;
}

const CategorySection = memo(function CategorySection({
  category,
  files,
  profile,
  saving,
  onModeChange,
}: CategorySectionProps) {
  const meta = CATEGORY_META[category];
  if (files.length === 0) return null;

  return (
    <div>
      {/* Category label */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        />
        <span className={`${sectionLabelClass} flex-1 text-muted-foreground`}>{meta.label}</span>
        <span className="text-[9px] text-muted-foreground/50">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </div>
      {/* File rows */}
      <div className="space-y-0">
        {files.map((file) => (
          <FileRow
            key={file.path}
            file={file}
            mode={profile[file.path] ?? DEFAULT_CONTEXT_MODE}
            saving={saving}
            onModeChange={onModeChange}
          />
        ))}
      </div>
    </div>
  );
});

// ── Stats bar ─────────────────────────────────────────────────────────────────

interface StatsBarProps {
  profile: ContextProfile;
  totalFiles: number;
}

const StatsBar = memo(function StatsBar({ profile, totalFiles }: StatsBarProps) {
  const overrideCount = Object.keys(profile).length;
  const alwaysCount = Object.values(profile).filter((m) => m === "always").length;
  const neverCount = Object.values(profile).filter((m) => m === "never").length;

  if (overrideCount === 0) return null;

  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5">
      <span className="text-[9px] text-muted-foreground/70">
        {overrideCount} of {totalFiles} overridden
      </span>
      {alwaysCount > 0 && (
        <span className="text-[9px] font-medium text-indigo-400">{alwaysCount} always</span>
      )}
      {neverCount > 0 && (
        <span className="text-[9px] font-medium text-rose-400">{neverCount} never</span>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

/**
 * ContextProfileEditor — per-file context mode controls.
 *
 * Allows users to pin files as Always/Never injected into agent context,
 * overriding the gateway's smart selection. Persists to gateway config.
 */
export const ContextProfileEditor = memo(function ContextProfileEditor({
  agentId,
  client,
  status,
}: ContextProfileEditorProps) {
  const { categories, loading: budgetLoading } = useContextBudget(agentId);
  const { profile, loading: profileLoading, saving, error, setMode, reload } = useContextProfile(
    client,
    status,
    agentId,
  );

  const loading = budgetLoading || profileLoading;

  const handleModeChange = useCallback(
    async (filePath: string, mode: ContextMode) => {
      try {
        await setMode(filePath, mode);
      } catch {
        // Error already set in hook state; no additional handling needed
      }
    },
    [setMode],
  );

  // Count all files across categories
  const totalFiles = BUDGET_CATEGORY_ORDER.reduce(
    (sum, cat) => sum + categories[cat].files.length,
    0,
  );

  const isDisconnected = status !== "connected";

  return (
    <div className="flex flex-col gap-0" data-testid="context-profile-editor">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className={`${sectionLabelClass} flex-1`}>Context Mode Controls</h3>
        {saving && (
          <span className="text-[9px] text-muted-foreground animate-pulse">Saving…</span>
        )}
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:text-foreground transition hover:bg-muted/60 disabled:opacity-40"
          onClick={() => void reload()}
          disabled={loading || isDisconnected}
          aria-label="Reload context profile"
          data-testid="context-profile-reload-btn"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Disconnected notice */}
      {isDisconnected && (
        <div className="mx-3 mb-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
          Connect to the gateway to manage context modes.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && totalFiles === 0 && (
        <div className="space-y-2 px-3 pb-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      )}

      {/* Content */}
      {(!loading || totalFiles > 0) && profile !== null && !isDisconnected && (
        <>
          {/* Stats bar — only shown when there are overrides */}
          <StatsBar profile={profile} totalFiles={totalFiles} />

          {/* Per-category file rows */}
          <div className="space-y-1">
            {BUDGET_CATEGORY_ORDER.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                files={categories[cat].files}
                profile={profile}
                saving={saving}
                onModeChange={handleModeChange}
              />
            ))}
          </div>

          {/* Empty state */}
          {totalFiles === 0 && !loading && (
            <div className="px-3 py-6 text-center">
              <p className="text-[10px] text-muted-foreground">
                No workspace files found for this agent.
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="mx-3 mt-2 mb-1 rounded-md border border-border/40 bg-muted/20 px-3 py-2">
            <p className={`mb-1.5 ${sectionLabelClass} text-muted-foreground/70`}>Mode legend</p>
            <div className="space-y-1">
              {CONTEXT_MODES.map((m) => (
                <div key={m} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      m === "always"
                        ? "text-indigo-400"
                        : m === "never"
                          ? "text-rose-400"
                          : "text-primary"
                    }`}
                  >
                    {CONTEXT_MODE_LABELS[m]}
                  </span>
                  <span className="text-[9px] text-muted-foreground/70 leading-relaxed">
                    {CONTEXT_MODE_DESCRIPTIONS[m]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
});
