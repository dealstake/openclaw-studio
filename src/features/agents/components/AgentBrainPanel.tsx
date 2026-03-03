"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, X } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import {
  AGENT_FILE_META,
  AGENT_FILE_NAMES,
  AGENT_FILE_PLACEHOLDERS,
  type AgentFileName,
} from "@/lib/agents/agentFiles";
import { useAgentFilesEditor } from "@/features/agents/hooks/useAgentFilesEditor";
import { extractHeadings } from "@/features/agents/lib/markdownHeadings";
import { HINTS_BY_FILE } from "@/features/agents/lib/sectionHints";
import { AgentInspectHeader } from "./AgentInspectHeader";
import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import { HeartbeatsSettingsSection } from "./HeartbeatsSettingsSection";
import { ModelPicker } from "./ModelPicker";
import { BrainSectionNav } from "./BrainSectionNav";
import { TooltipProvider } from "@/components/ui/tooltip";

/* ── Line-numbered editor ──────────────────────────────────── */

type LineNumberedEditorProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

export type LineNumberedEditorRef = {
  scrollToLine: (lineNumber: number) => void;
};

const LineNumberedEditor = memo(
  forwardRef<LineNumberedEditorRef, LineNumberedEditorProps>(
    function LineNumberedEditor(
      { value, placeholder, disabled, ariaLabel, onChange },
      ref
    ) {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      const gutterRef = useRef<HTMLDivElement>(null);

      const lines = useMemo(() => {
        const count = value.split("\n").length;
        return Array.from({ length: count }, (_, i) => i + 1);
      }, [value]);

      const handleScroll = useCallback(() => {
        if (textareaRef.current && gutterRef.current) {
          gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }
      }, []);

      useImperativeHandle(ref, () => ({
        scrollToLine: (lineNumber: number) => {
          if (!textareaRef.current || !gutterRef.current) return;
          const textarea = textareaRef.current;
          const computedStyle = window.getComputedStyle(textarea);
          const lh = computedStyle.lineHeight;
          // ⚠️ parseFloat("normal") returns NaN — fall back to fontSize * 1.2
          const lineHeight =
            lh === "normal"
              ? parseFloat(computedStyle.fontSize) * 1.2
              : parseFloat(lh);

          const scrollTop = (lineNumber - 1) * lineHeight;
          textarea.scrollTop = scrollTop;
          gutterRef.current.scrollTop = scrollTop; // sync gutter immediately

          // Move cursor to the target line
          const contentLines = textarea.value.split("\n");
          let charOffset = 0;
          for (let i = 0; i < lineNumber - 1 && i < contentLines.length; i++) {
            charOffset += contentLines[i].length + 1;
          }
          textarea.selectionStart = charOffset;
          textarea.selectionEnd = charOffset;
          textarea.focus();
        },
      }));

      return (
        <div className="flex h-full min-h-0 overflow-hidden rounded-md border border-border/80 bg-background/80">
          <div
            ref={gutterRef}
            className="flex-none select-none overflow-hidden border-r border-border/60 bg-muted/40 py-2 pr-2 pl-2 text-right font-mono text-xs leading-[1.625] text-muted-foreground/60"
            aria-hidden="true"
          >
            {lines.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            aria-label={ariaLabel}
            className="h-full min-h-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2 font-mono text-xs leading-[1.625] text-foreground outline-none"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onScroll={handleScroll}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    }
  )
);

/* ── AgentBrainPanel ──────────────────────────────────────── */

type AgentBrainPanelProps = {
  client: GatewayClient;
  agents: AgentState[];
  selectedAgentId: string | null;
  onClose: () => void;
  /** Hide the header bar (used when embedded in another panel) */
  hideHeader?: boolean;
  /** Controlled file tab — when provided, panel syncs to this tab */
  activeTab?: AgentFileName;
  /** Callback when file tab changes (for lifting state) */
  onTabChange?: (tab: AgentFileName) => void;
  /** Controlled preview mode — when provided, panel syncs to this */
  previewMode?: boolean;
  /** Callback when preview/edit toggle changes */
  onPreviewModeChange?: (preview: boolean) => void;
  /** Gateway connection status — needed for heartbeats */
  status?: GatewayStatus;
  /** Available models for model picker */
  models?: GatewayModelChoice[];
  /** Current model value (provider/id) */
  modelValue?: string;
  /** Callback when model changes */
  onModelChange?: (value: string | null) => void;
};

export const AgentBrainPanel = memo(function AgentBrainPanel({
  client,
  agents,
  selectedAgentId,
  onClose,
  hideHeader,
  activeTab: controlledTab,
  onTabChange,
  previewMode: controlledPreview,
  onPreviewModeChange,
  status,
  models,
  modelValue,
  onModelChange,
}: AgentBrainPanelProps) {
  const selectedAgent = useMemo(
    () =>
      selectedAgentId
        ? agents.find((entry) => entry.agentId === selectedAgentId) ?? null
        : null,
    [agents, selectedAgentId]
  );

  const {
    agentFiles,
    agentFileTab,
    agentFilesLoading,
    agentFilesSaving,
    agentFilesDirty,
    agentFilesError,
    setAgentFileContent,
    handleAgentFileTabChange,
    saveAgentFiles,
  } = useAgentFilesEditor({ client, agentId: selectedAgent?.agentId ?? null });

  // Local preview state (used when uncontrolled)
  const [localPreview, setLocalPreview] = useState(true);
  const previewMode = controlledPreview ?? localPreview;
  const setPreviewMode = useCallback(
    (v: boolean) => {
      if (onPreviewModeChange) onPreviewModeChange(v);
      else setLocalPreview(v);
    },
    [onPreviewModeChange]
  );

  // Sync controlled tab → hook tab
  const syncingRef = useRef(false);
  useEffect(() => {
    if (controlledTab && controlledTab !== agentFileTab && !syncingRef.current) {
      syncingRef.current = true;
      void handleAgentFileTabChange(controlledTab).finally(() => {
        syncingRef.current = false;
      });
    }
  }, [controlledTab, agentFileTab, handleAgentFileTabChange]);

  // Notify parent when hook tab changes
  useEffect(() => {
    if (onTabChange && agentFileTab) {
      onTabChange(agentFileTab);
    }
  }, [agentFileTab, onTabChange]);

  const handleTabChange = useCallback(
    async (nextTab: AgentFileName) => {
      await handleAgentFileTabChange(nextTab);
      if (onTabChange) onTabChange(nextTab);
    },
    [handleAgentFileTabChange, onTabChange]
  );

  const handleClose = useCallback(async () => {
    if (agentFilesSaving) return;
    if (agentFilesDirty) {
      const saved = await saveAgentFiles();
      if (!saved) return;
    }
    onClose();
  }, [agentFilesDirty, agentFilesSaving, onClose, saveAgentFiles]);

  /* ── Section navigation ──────────────────────────────────── */
  const editorRef = useRef<LineNumberedEditorRef>(null);
  const [activeHeading, setActiveHeading] = useState<number | null>(null);

  const currentContent = agentFiles[agentFileTab].content;

  const headings = useMemo(
    () => extractHeadings(currentContent),
    [currentContent]
  );

  const fileHints = useMemo(
    () => HINTS_BY_FILE[agentFileTab] ?? [],
    [agentFileTab]
  );

  const handleNavigate = useCallback((lineNumber: number) => {
    setActiveHeading(lineNumber);
    editorRef.current?.scrollToLine(lineNumber);
  }, []);

  /* ── File metadata ──────────────────────────────────────── */
  const wordCount = useMemo(
    () => currentContent.split(/\s+/).filter(Boolean).length,
    [currentContent]
  );
  const charCount = useMemo(() => currentContent.length, [currentContent]);

  /* ── Search state ──────────────────────────────────── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Defer the query used for match counting so typing stays responsive.
  // The deferred value lags one render behind the live input value,
  // keeping the regex scan off the critical keystroke path.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const searchMatchCount = useMemo(() => {
    if (!deferredSearchQuery.trim()) return 0;
    const regex = new RegExp(
      deferredSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    return (currentContent.match(regex) ?? []).length;
  }, [currentContent, deferredSearchQuery]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  /* ── Keyboard shortcuts (Cmd+1..7 for tabs, Cmd+F for search) ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      // Cmd+F — toggle search
      if (e.key === "f") {
        e.preventDefault();
        setSearchOpen((prev) => {
          if (!prev) {
            return true;
          }
          setSearchQuery("");
          return false;
        });
        return;
      }

      // Cmd+1..7 — switch file tabs
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= AGENT_FILE_NAMES.length) {
        e.preventDefault();
        const targetTab = AGENT_FILE_NAMES[num - 1];
        if (targetTab && targetTab !== agentFileTab) {
          void handleTabChange(targetTab);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [agentFileTab, handleTabChange]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  return (
    <div
      className="agent-inspect-panel flex min-h-0 flex-col overflow-hidden"
      data-testid="agent-brain-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      {!hideHeader && (
        <AgentInspectHeader
          label="Brain files"
          title={selectedAgent?.name ?? "No agent selected"}
          onClose={() => {
            void handleClose();
          }}
          closeTestId="agent-brain-close"
          closeDisabled={agentFilesSaving}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <section className="flex min-h-0 flex-1 flex-col" data-testid="agent-brain-files">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>{AGENT_FILE_META[agentFileTab].hint}</SectionLabel>
          </div>

          {agentFilesError ? (
            <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
              {agentFilesError}
            </div>
          ) : null}

          {/* ── File tabs ── */}
          <div
            className="mt-4 flex flex-wrap items-end gap-2"
            role="tablist"
            aria-label="Agent brain files"
          >
            {AGENT_FILE_NAMES.map((name, idx) => {
              const active = name === agentFileTab;
              const label = AGENT_FILE_META[name].title.replace(".md", "");
              const shortcut = `⌘${idx + 1}`;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={`${AGENT_FILE_META[name].hint} (${shortcut})`}
                  className={`rounded-full border px-3 py-1.5 ${sectionLabelClass} transition ${
                    active
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:border-border/80 hover:bg-muted focus-ring"
                  }`}
                  onClick={() => {
                    void handleTabChange(name);
                  }}
                >
                  {label}
                  {active && agentFilesDirty && (
                    <span
                      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                      title="Unsaved changes"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Controls row: metadata + search + preview toggle ── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Metadata — desktop only */}
            <div className="hidden flex-1 items-center gap-3 text-xs text-muted-foreground md:flex">
              <span>{wordCount} words</span>
              <span className="h-3 w-px bg-border/60" />
              <span>{headings.length} sections</span>
              <span className="h-3 w-px bg-border/60" />
              <span>{charCount.toLocaleString()} chars</span>
            </div>

            {/* Spacer on mobile */}
            <div className="flex-1 md:hidden" />

            {/* Search + preview toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`rounded-md border px-2 py-1 text-muted-foreground transition hover:text-foreground ${
                  searchOpen
                    ? "border-border bg-background text-foreground"
                    : "border-transparent"
                }`}
                onClick={() => {
                  if (searchOpen) closeSearch();
                  else setSearchOpen(true);
                }}
                title="Search in file (⌘F)"
                aria-label="Search in file"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-4 w-px bg-border/60" />
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1 ${sectionLabelClass} transition ${
                  previewMode
                    ? "border-border bg-background text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/70"
                }`}
                onClick={() => setPreviewMode(true)}
              >
                Preview
              </button>
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1 ${sectionLabelClass} transition ${
                  previewMode
                    ? "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/70"
                    : "border-border bg-background text-foreground"
                }`}
                onClick={() => setPreviewMode(false)}
              >
                Edit
              </button>
            </div>
          </div>

          {/* ── Search bar ── */}
          {searchOpen && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Search in file…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeSearch();
                  }
                }}
              />
              {searchQuery && (
                <span className="flex-none text-xs text-muted-foreground">
                  {searchMatchCount} {searchMatchCount === 1 ? "match" : "matches"}
                </span>
              )}
              <button
                type="button"
                className="flex-none rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── Editor area: section nav sidebar + editor/preview ── */}
          <div className="mt-3 flex min-h-0 flex-1 gap-0 overflow-hidden rounded-md bg-muted/30 p-2">
            {/* Section navigator — edit mode only */}
            {!previewMode && (
              <BrainSectionNav
                headings={headings}
                activeHeading={activeHeading}
                onNavigate={handleNavigate}
                hints={fileHints}
                defaultCollapsed={false}
              />
            )}

            {/* Main content area */}
            <div className="min-h-0 flex-1 overflow-hidden">
              {previewMode ? (
                <div className="h-full overflow-y-auto rounded-md border border-border/80 bg-background/80 px-3 py-2">
                  {currentContent.trim().length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {AGENT_FILE_PLACEHOLDERS[agentFileTab]}
                    </p>
                  ) : (
                    <MarkdownViewer content={currentContent} />
                  )}
                </div>
              ) : (
                <LineNumberedEditor
                  ref={editorRef}
                  value={currentContent}
                  placeholder={
                    currentContent.trim().length === 0
                      ? AGENT_FILE_PLACEHOLDERS[agentFileTab]
                      : undefined
                  }
                  disabled={agentFilesLoading || agentFilesSaving}
                  ariaLabel={`Edit ${agentFileTab} file`}
                  onChange={setAgentFileContent}
                />
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 pt-2">
            <div
              className={`text-xs ${
                agentFilesDirty ? "text-amber-500" : "text-muted-foreground"
              }`}
            >
              {agentFilesDirty ? "Unsaved changes" : "All changes saved"}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {/* ── Model & Thinking ── */}
          {models && models.length > 0 && modelValue && onModelChange && (
            <div
              className="rounded-md border border-border/80 bg-card/70 p-4"
              data-testid="brain-model-picker"
            >
              <SectionLabel>Model &amp; Thinking</SectionLabel>
              <div className="mt-3">
                <ModelPicker models={models} value={modelValue} onChange={onModelChange} />
              </div>
            </div>
          )}

          {/* ── Heartbeats ── */}
          {status && selectedAgent && (
            <TooltipProvider>
              <HeartbeatsSettingsSection
                client={client}
                agentId={selectedAgent.agentId}
                status={status}
              />
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
});
