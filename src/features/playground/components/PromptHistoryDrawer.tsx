"use client";

import { memo, useCallback, useRef, useState } from "react";
import {
  Clock,
  Download,
  Upload,
  Trash2,
  X,
  BookmarkPlus,
  Bookmark,
  Play,

} from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { SectionLabel } from "@/components/SectionLabel";
import type { PromptHistoryEntry, UsePromptHistoryReturn } from "../hooks/usePromptHistory";
import type { PromptPreset } from "../lib/types";

interface PromptHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  history: UsePromptHistoryReturn;
  onReplay: (entry: { systemPrompt: string; userMessage: string; model: string }) => void;
  onSavePreset: (entry: PromptHistoryEntry) => void;
}

export const PromptHistoryDrawer = memo(function PromptHistoryDrawer({
  open,
  onClose,
  history,
  onReplay,
  onSavePreset,
}: PromptHistoryDrawerProps) {
  const [tab, setTab] = useState<"history" | "presets">("history");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const json = history.exportPresets();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [history]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          history.importPresets(reader.result);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [history],
  );

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <SectionLabel>Prompt Library</SectionLabel>
        </div>
        <div className="flex items-center gap-1">
          {tab === "presets" && (
            <>
              <IconButton onClick={handleExport} aria-label="Export presets" title="Export presets as JSON">
                <Download className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton onClick={handleImport} aria-label="Import presets" title="Import presets from JSON">
                <Upload className="h-3.5 w-3.5" />
              </IconButton>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}
          {tab === "history" && history.history.length > 0 && (
            <IconButton
              onClick={history.clearHistory}
              aria-label="Clear history"
              title="Clear all history"
              variant="destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <IconButton onClick={onClose} aria-label="Close prompt library">
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History ({history.history.length})
        </TabButton>
        <TabButton active={tab === "presets"} onClick={() => setTab("presets")}>
          Presets ({history.presets.length})
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "history" ? (
          history.history.length === 0 ? (
            <EmptyState message="No prompt history yet. Run a prompt in the playground to see it here." />
          ) : (
            <div className="flex flex-col">
              {history.history.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  onReplay={() => onReplay(entry)}
                  onSavePreset={() => onSavePreset(entry)}
                  onDelete={() => history.removeEntry(entry.id)}
                />
              ))}
            </div>
          )
        ) : history.presets.length === 0 ? (
          <EmptyState message="No saved presets. Save a prompt from history or import a JSON file." />
        ) : (
          <div className="flex flex-col">
            {history.presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                onReplay={() => onReplay(preset)}
                onDelete={() => history.removePreset(preset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Sub-components ──────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-b-2 border-primary text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
      <Clock className="h-8 w-8 text-muted-foreground/30" aria-hidden />
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
        {message}
      </p>
    </div>
  );
}

function HistoryRow({
  entry,
  onReplay,
  onSavePreset,
  onDelete,
}: {
  entry: PromptHistoryEntry;
  onReplay: () => void;
  onSavePreset: () => void;
  onDelete: () => void;
}) {
  const modelShort = entry.model.split("/").pop() ?? entry.model;
  const timeStr = new Date(entry.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date(entry.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const cost = entry.estimatedCostUsd != null ? `$${entry.estimatedCostUsd.toFixed(4)}` : null;

  return (
    <div className="group flex items-start gap-2 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {entry.userMessage.slice(0, 100)}
        </p>
        {entry.systemPrompt && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            System: {entry.systemPrompt.slice(0, 60)}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{modelShort}</span>
          <span>·</span>
          <span>{dateStr} {timeStr}</span>
          {cost && (
            <>
              <span>·</span>
              <span>{cost}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <IconButton onClick={onReplay} aria-label="Replay prompt" title="Load into playground">
          <Play className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={onSavePreset} aria-label="Save as preset" title="Save as preset">
          <BookmarkPlus className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={onDelete} aria-label="Delete entry" variant="destructive">
          <Trash2 className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}

function PresetRow({
  preset,
  onReplay,
  onDelete,
}: {
  preset: PromptPreset;
  onReplay: () => void;
  onDelete: () => void;
}) {
  const modelShort = preset.model.split("/").pop() ?? preset.model;

  return (
    <div className="group flex items-start gap-2 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-muted/30">
      <Bookmark className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/60" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{preset.label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {preset.userMessage.slice(0, 80)}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{modelShort}</span>
          {preset.systemPrompt && (
            <>
              <span>·</span>
              <span>Has system prompt</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <IconButton onClick={onReplay} aria-label="Load preset" title="Load into playground">
          <Play className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={onDelete} aria-label="Delete preset" variant="destructive">
          <Trash2 className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
