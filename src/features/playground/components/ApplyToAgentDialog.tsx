"use client";

import { memo, useCallback, useState } from "react";
import { FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AGENT_FILE_META,
  type AgentFileName,
} from "@/lib/agents/agentFiles";
import {
  readGatewayAgentFile,
  writeGatewayAgentFile,
} from "@/lib/gateway/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// Only show brain files where a system prompt makes sense
const APPLICABLE_FILES: AgentFileName[] = [
  "SOUL.md",
  "AGENTS.md",
  "IDENTITY.md",
];

type ApplyMode = "replace" | "append";

interface ApplyToAgentDialogProps {
  open: boolean;
  onClose: () => void;
  systemPrompt: string;
  client: GatewayClient;
  agentId: string | null;
}

export const ApplyToAgentDialog = memo(function ApplyToAgentDialog({
  open,
  onClose,
  systemPrompt,
  client,
  agentId,
}: ApplyToAgentDialogProps) {
  const [targetFile, setTargetFile] = useState<AgentFileName>("SOUL.md");
  const [mode, setMode] = useState<ApplyMode>("replace");
  const [saving, setSaving] = useState(false);

  const handleApply = useCallback(async () => {
    if (!agentId || !systemPrompt.trim()) return;
    setSaving(true);
    try {
      let content = systemPrompt.trim();

      if (mode === "append") {
        const existing = await readGatewayAgentFile({
          client,
          agentId,
          name: targetFile,
        });
        if (existing.exists && existing.content.trim()) {
          content = `${existing.content.trim()}\n\n---\n\n${content}`;
        }
      }

      await writeGatewayAgentFile({
        client,
        agentId,
        name: targetFile,
        content,
      });

      toast.success(`System prompt written to ${targetFile}`);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to write brain file";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [agentId, systemPrompt, mode, targetFile, client, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Apply to Agent
          </h3>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-4 py-4">
          {!agentId && (
            <p className="text-xs text-destructive">
              No agent selected. Select an agent first.
            </p>
          )}

          {/* Preview */}
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              System prompt preview
            </p>
            <p className="line-clamp-4 text-xs text-foreground/80 font-mono whitespace-pre-wrap">
              {systemPrompt.trim() || "(empty)"}
            </p>
          </div>

          {/* Target file */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Target file
            </label>
            <select
              value={targetFile}
              onChange={(e) =>
                setTargetFile(e.target.value as AgentFileName)
              }
              className="w-full appearance-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs
                text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {APPLICABLE_FILES.map((name) => (
                <option key={name} value={name}>
                  {name} — {AGENT_FILE_META[name].hint}
                </option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Write mode
            </label>
            <div className="flex gap-2">
              <ModeButton
                active={mode === "replace"}
                onClick={() => setMode("replace")}
                label="Replace"
                hint="Overwrite file contents"
              />
              <ModeButton
                active={mode === "append"}
                onClick={() => setMode("append")}
                label="Append"
                hint="Add to end of file"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors
              hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving || !agentId || !systemPrompt.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium
              text-primary-foreground transition-colors hover:bg-primary/90
              disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {mode === "replace" ? "Replace" : "Append"} to {targetFile}
          </button>
        </div>
      </div>
    </div>
  );
});

function ModeButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      <span className="block text-xs font-medium">{label}</span>
      <span className="block text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}
