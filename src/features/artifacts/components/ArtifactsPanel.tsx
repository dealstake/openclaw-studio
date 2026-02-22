"use client";

import { memo, useCallback, useMemo } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Skeleton } from "@/components/Skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PanelIconButton } from "@/components/PanelIconButton";
import {
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  Presentation,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Pin,
  Upload,
  X,
  PackageOpen,
} from "lucide-react";

import type { DriveFile } from "../types";
import { fileIconKey, fileTypeLabel, formatTimestamp } from "../lib/fileTypes";
import { sortFiles } from "../lib/sort";
import { formatSizeFromString } from "@/lib/text/format";
import { useArtifacts } from "../hooks/useArtifacts";
import { useArtifactPins } from "../hooks/useArtifactPins";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArtifactsPanelProps {
  isSelected: boolean;
  client?: GatewayClient;
  status?: string;
}

// ── Icon mapping (React elements) ──────────────────────────────────────────────

const ICON_CLASS = "h-4 w-4 shrink-0";

function fileIcon(mime: string) {
  const key = fileIconKey(mime);
  switch (key) {
    case "spreadsheet":
      return <FileSpreadsheet className={`${ICON_CLASS} text-emerald-500`} />;
    case "presentation":
      return <Presentation className={`${ICON_CLASS} text-amber-500`} />;
    case "document":
      return <FileText className={`${ICON_CLASS} text-blue-500`} />;
    case "form":
      return <ClipboardList className={`${ICON_CLASS} text-violet-500`} />;
    case "image":
      return <FileImage className={`${ICON_CLASS} text-pink-500`} />;
    case "code":
      return <FileCode className={`${ICON_CLASS} text-orange-500`} />;
    case "text":
      return <FileText className={`${ICON_CLASS} text-muted-foreground`} />;
    default:
      return <File className={`${ICON_CLASS} text-muted-foreground`} />;
  }
}

// ── File row ───────────────────────────────────────────────────────────────────

const ArtifactRow = memo(function ArtifactRow({
  file,
  isPinned,
  onTogglePin,
}: {
  file: DriveFile;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    if (file.webViewLink) {
      window.open(file.webViewLink, "_blank", "noopener,noreferrer");
    }
  }, [file.webViewLink]);

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePin(file.id);
    },
    [file.id, onTogglePin],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full items-start gap-3.5 rounded-lg border border-border/70 bg-card/65 px-4 py-3.5 text-left transition hover:border-border hover:bg-muted/55 focus-ring"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
        {fileIcon(file.mimeType)}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[12px] font-medium leading-tight text-foreground transition-colors group-hover:text-primary-text"
          title={file.name}
        >
          {file.name}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wide">
            {fileTypeLabel(file.mimeType)}
          </span>
          <span>{formatSizeFromString(file.size)}</span>
          <span>{formatTimestamp(file.modifiedTime)}</span>
        </div>
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handlePin}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            isPinned
              ? "text-primary opacity-100 hover:bg-muted/50"
              : "text-muted-foreground opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-muted/50"
          }`}
          title={isPinned ? "Unpin" : "Pin to top"}
          aria-label={isPinned ? "Unpin" : "Pin to top"}
        >
          <Pin className={`h-3 w-3 ${isPinned ? "fill-primary" : ""}`} />
        </button>
      </div>
    </button>
  );
});

// ── Main panel ─────────────────────────────────────────────────────────────────

export const ArtifactsPanel = memo(function ArtifactsPanel({
  isSelected,
}: ArtifactsPanelProps) {
  const {
    files,
    loading,
    error,
    refreshing,
    uploading,
    uploadError,
    fileInputRef,
    fetchFiles,
    handleUpload,
    clearUploadError,
  } = useArtifacts(isSelected);

  const { pins, sortDir, toggleSort, togglePin } = useArtifactPins();

  // Sort files, then partition pinned to top
  const sortedFiles = useMemo(() => {
    const sorted = sortFiles(files, sortDir);
    const pinned = sorted.filter((f) => pins.has(f.id));
    const unpinned = sorted.filter((f) => !pins.has(f.id));
    return { pinned, unpinned };
  }, [files, sortDir, pins]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      void handleUpload(e.dataTransfer.files);
    },
    [handleUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const artifactsPollCallback = useCallback(() => {
    void fetchFiles(true);
  }, [fetchFiles]);

  useVisibilityRefresh(artifactsPollCallback, {
    pollMs: 60_000,
    enabled: isSelected,
    initialDelayMs: 120_000,
  });

  if (!isSelected) return null;

  const hasPinned = sortedFiles.pinned.length > 0;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files)}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="console-title text-2xl leading-none text-foreground">
          Files ({files.length})
        </p>
        <div className="flex items-center gap-1">
          <PanelIconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload file"
            aria-label="Upload file"
          >
            <Upload
              className={`h-3.5 w-3.5 ${uploading ? "animate-pulse" : ""}`}
            />
          </PanelIconButton>
          <PanelIconButton
            onClick={toggleSort}
            title={
              sortDir === "newest" ? "Sorted newest first" : "Sorted oldest first"
            }
            aria-label={
              sortDir === "newest" ? "Sort oldest first" : "Sort newest first"
            }
          >
            {sortDir === "newest" ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </PanelIconButton>
          <PanelIconButton
            onClick={() => void fetchFiles(true)}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </PanelIconButton>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="mx-3 mb-2 flex items-center gap-2">
          <ErrorBanner
            message={uploadError}
            className="flex-1"
          />
          <button
            type="button"
            onClick={clearUploadError}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50"
            aria-label="Dismiss upload error"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={(e) => e.preventDefault()}
      >
        {loading && !files.length ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-md p-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error && !files.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <ErrorBanner
              message={error}
              onRetry={() => void fetchFiles()}
            />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <PackageOpen className="h-5 w-5" />
            <p className="text-xs">No artifacts yet</p>
            <p className="text-[10px]">
              Upload files or let agents generate them
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedFiles.pinned.map((file) => (
              <ArtifactRow
                key={file.id}
                file={file}
                isPinned
                onTogglePin={togglePin}
              />
            ))}
            {hasPinned && sortedFiles.unpinned.length > 0 && (
              <div className="mx-3 my-1 border-t border-border/30" />
            )}
            {sortedFiles.unpinned.map((file) => (
              <ArtifactRow
                key={file.id}
                file={file}
                isPinned={false}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
