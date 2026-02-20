"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  AGENT_FILE_META,
  AGENT_FILE_NAMES,
  AGENT_FILE_PLACEHOLDERS,
  type AgentFileName,
} from "@/lib/agents/agentFiles";
import { useAgentFilesEditor } from "@/features/agents/hooks/useAgentFilesEditor";
import { AgentInspectHeader } from "./AgentInspectHeader";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";

/* ── Line-numbered editor ──────────────────────────────────── */

type LineNumberedEditorProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

const LineNumberedEditor = memo(function LineNumberedEditor({
  value,
  placeholder,
  disabled,
  ariaLabel,
  onChange,
}: LineNumberedEditorProps) {
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
});

/* ── AgentBrainPanel ──────────────────────────────────────── */

type AgentBrainPanelProps = {
  client: GatewayClient;
  agents: AgentState[];
  selectedAgentId: string | null;
  onClose: () => void;
  /** Controlled file tab — when provided, panel syncs to this tab */
  activeTab?: AgentFileName;
  /** Callback when file tab changes (for lifting state) */
  onTabChange?: (tab: AgentFileName) => void;
  /** Controlled preview mode — when provided, panel syncs to this */
  previewMode?: boolean;
  /** Callback when preview/edit toggle changes */
  onPreviewModeChange?: (preview: boolean) => void;
};

export const AgentBrainPanel = memo(function AgentBrainPanel({
  client,
  agents,
  selectedAgentId,
  onClose,
  activeTab: controlledTab,
  onTabChange,
  previewMode: controlledPreview,
  onPreviewModeChange,
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

  return (
    <div
      className="agent-inspect-panel flex min-h-0 flex-col overflow-hidden"
      data-testid="agent-brain-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      <AgentInspectHeader
        label="Brain files"
        title={selectedAgent?.name ?? "No agent selected"}
        onClose={() => {
          void handleClose();
        }}
        closeTestId="agent-brain-close"
        closeDisabled={agentFilesSaving}
      />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <section className="flex min-h-0 flex-1 flex-col" data-testid="agent-brain-files">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>
              {AGENT_FILE_META[agentFileTab].hint}
            </SectionLabel>
          </div>
          {agentFilesError ? (
            <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
              {agentFilesError}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            {AGENT_FILE_NAMES.map((name) => {
              const active = name === agentFileTab;
              const label = AGENT_FILE_META[name].title.replace(".md", "");
              return (
                <button
                  key={name}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 ${sectionLabelClass} transition ${
                    active
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:border-border/80 hover:bg-muted"
                  }`}
                  onClick={() => {
                    void handleTabChange(name);
                  }}
                >
                  {label}
                  {active && agentFilesDirty && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-end gap-1">
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

          <div className="mt-3 min-h-0 flex-1 rounded-md bg-muted/30 p-2">
            {previewMode ? (
              <div className="h-full overflow-y-auto rounded-md border border-border/80 bg-background/80 px-3 py-2">
                {agentFiles[agentFileTab].content.trim().length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {AGENT_FILE_PLACEHOLDERS[agentFileTab]}
                  </p>
                ) : (
                  <MarkdownViewer content={agentFiles[agentFileTab].content} />
                )}
              </div>
            ) : (
              <LineNumberedEditor
                value={agentFiles[agentFileTab].content}
                placeholder={
                  agentFiles[agentFileTab].content.trim().length === 0
                    ? AGENT_FILE_PLACEHOLDERS[agentFileTab]
                    : undefined
                }
                disabled={agentFilesLoading || agentFilesSaving}
                ariaLabel={`Edit ${agentFileTab} file`}
                onChange={setAgentFileContent}
              />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 pt-2">
            <div className={`text-xs ${agentFilesDirty ? "text-amber-500" : "text-muted-foreground"}`}>
              {agentFilesDirty ? "Unsaved changes" : "All changes saved"}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});
