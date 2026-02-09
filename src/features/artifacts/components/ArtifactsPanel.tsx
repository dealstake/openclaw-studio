"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  Presentation,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

interface ArtifactsPanelProps {
  isSelected: boolean;
}

// ── MIME → Icon mapping ────────────────────────────────────────────────────────

function fileIcon(mime: string) {
  if (mime.includes("spreadsheet") || mime.includes("csv") || mime.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (mime.includes("presentation") || mime.includes("slides"))
    return <Presentation className="h-4 w-4 shrink-0 text-amber-500" />;
  if (mime.includes("document") || mime.includes("word"))
    return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
  if (mime.includes("form"))
    return <ClipboardList className="h-4 w-4 shrink-0 text-violet-500" />;
  if (mime.includes("image"))
    return <FileImage className="h-4 w-4 shrink-0 text-pink-500" />;
  if (mime.includes("script") || mime.includes("json") || mime.includes("javascript") || mime.includes("python") || mime.includes("shellscript"))
    return <FileCode className="h-4 w-4 shrink-0 text-orange-500" />;
  if (mime.includes("text") || mime.includes("plain") || mime.includes("pdf"))
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

// ── MIME → human-readable type ─────────────────────────────────────────────────

function fileTypeLabel(mime: string): string {
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.includes("csv")) return "CSV";
  if (mime.includes("presentation") || mime.includes("slides")) return "Presentation";
  if (mime === "application/vnd.google-apps.document") return "Google Doc";
  if (mime.includes("document") || mime.includes("word")) return "Document";
  if (mime.includes("form")) return "Form";
  if (mime.includes("image")) return "Image";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("script") || mime.includes("shellscript")) return "Script";
  if (mime.includes("json")) return "JSON";
  if (mime.includes("javascript")) return "JavaScript";
  if (mime.includes("text") || mime.includes("plain")) return "Text";
  return "File";
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function formatSize(bytes?: string): string {
  if (!bytes) return "—";
  const b = parseInt(bytes, 10);
  if (isNaN(b)) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

// ── File row ───────────────────────────────────────────────────────────────────

const ArtifactRow = memo(function ArtifactRow({ file }: { file: DriveFile }) {
  const handleClick = useCallback(() => {
    if (file.webViewLink) {
      window.open(file.webViewLink, "_blank", "noopener,noreferrer");
    }
  }, [file.webViewLink]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition hover:border-border/60 hover:bg-muted/40"
    >
      {fileIcon(file.mimeType)}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-foreground group-hover:text-primary">
          {file.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wide">{fileTypeLabel(file.mimeType)}</span>
          <span className="opacity-40">·</span>
          <span>{formatSize(file.size)}</span>
          <span className="opacity-40">·</span>
          <span>{formatTimestamp(file.modifiedTime)}</span>
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-60" />
    </button>
  );
});

// ── Main panel ─────────────────────────────────────────────────────────────────

export const ArtifactsPanel = memo(function ArtifactsPanel({ isSelected }: ArtifactsPanelProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/artifacts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { files: DriveFile[] };
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSelected) return;
    void fetchFiles();

    // Auto-refresh every 60 seconds
    intervalRef.current = setInterval(() => void fetchFiles(true), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSelected, fetchFiles]);

  if (!isSelected) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Shared Artifacts
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
            Google Drive · {files.length} file{files.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchFiles(true)}
          disabled={refreshing}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {loading && !files.length ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Loading artifacts…
            </span>
          </div>
        ) : error && !files.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-center text-[11px] text-destructive">{error}</span>
            <button
              type="button"
              onClick={() => void fetchFiles()}
              className="mt-1 rounded-md border border-border/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition hover:bg-muted/40"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {files.map((file) => (
              <ArtifactRow key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
