"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  Presentation,
  RefreshCw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Pin,
  Upload,
  X,
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

type SortDirection = "newest" | "oldest";

// ── localStorage helpers ───────────────────────────────────────────────────────

const PINS_KEY = "trident-artifacts-pins";
const SORT_KEY = "trident-artifacts-sort";

function loadPins(): Set<string> {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function savePins(pins: Set<string>) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
  } catch { /* quota exceeded — silently ignore */ }
}

function loadSort(): SortDirection {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    return raw === "oldest" ? "oldest" : "newest";
  } catch {
    return "newest";
  }
}

function saveSort(dir: SortDirection) {
  try {
    localStorage.setItem(SORT_KEY, dir);
  } catch { /* silently ignore */ }
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

// ── Sort helper ────────────────────────────────────────────────────────────────

function sortFiles(files: DriveFile[], dir: SortDirection): DriveFile[] {
  return [...files].sort((a, b) => {
    const ta = new Date(a.modifiedTime).getTime();
    const tb = new Date(b.modifiedTime).getTime();
    return dir === "newest" ? tb - ta : ta - tb;
  });
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
    [file.id, onTogglePin]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full items-start gap-3.5 rounded-lg border border-border/70 bg-card/65 px-4 py-3.5 text-left transition hover:border-border hover:bg-muted/55"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
        {fileIcon(file.mimeType)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium leading-tight text-foreground group-hover:text-primary">
          {file.name}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wide">{fileTypeLabel(file.mimeType)}</span>
          <span>{formatSize(file.size)}</span>
          <span>{formatTimestamp(file.modifiedTime)}</span>
        </div>
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        <span
          role="button"
          tabIndex={0}
          onClick={handlePin}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onTogglePin(file.id); } }}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            isPinned
              ? "text-primary opacity-100 hover:bg-muted/50"
              : "text-muted-foreground opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-muted/50"
          }`}
          title={isPinned ? "Unpin" : "Pin to top"}
        >
          <Pin className={`h-3 w-3 ${isPinned ? "fill-primary" : ""}`} />
        </span>
      </div>
    </button>
  );
});

// ── Main panel ─────────────────────────────────────────────────────────────────

export const ArtifactsPanel = memo(function ArtifactsPanel({ isSelected }: ArtifactsPanelProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortDir, setSortDir] = useState<SortDirection>("newest");
  const [pins, setPins] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydrated = useRef(false);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setPins(loadPins());
    setSortDir(loadSort());
  }, []);

  const toggleSort = useCallback(() => {
    setSortDir((prev) => {
      const next = prev === "newest" ? "oldest" : "newest";
      saveSort(next);
      return next;
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePins(next);
      return next;
    });
  }, []);

  // Sort files, then partition pinned to top
  const sortedFiles = useMemo(() => {
    const sorted = sortFiles(files, sortDir);
    const pinned = sorted.filter((f) => pins.has(f.id));
    const unpinned = sorted.filter((f) => !pins.has(f.id));
    return { pinned, unpinned };
  }, [files, sortDir, pins]);

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

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/artifacts/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed (${res.status})`);
        }
      }
      await fetchFiles(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  useEffect(() => {
    if (!isSelected) return;
    void fetchFiles();

    intervalRef.current = setInterval(() => void fetchFiles(true), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSelected, fetchFiles]);

  if (!isSelected) return null;

  const hasPinned = sortedFiles.pinned.length > 0;

  return (
    <div className="flex h-full w-full flex-col">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
            title="Upload file"
          >
            <Upload className={`h-3 w-3 ${uploading ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">{uploading ? "Uploading…" : "Upload"}</span>
          </button>
          <button
            type="button"
            onClick={toggleSort}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            title={sortDir === "newest" ? "Sorted newest first" : "Sorted oldest first"}
          >
            {sortDir === "newest" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{sortDir === "newest" ? "Newest" : "Oldest"}</span>
          </button>
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
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="shrink-0 rounded p-0.5 hover:bg-destructive/20">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className={`flex-1 overflow-auto px-3 pb-3 transition ${dragOver ? "ring-2 ring-inset ring-primary/50 rounded-lg bg-primary/5" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
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
          <div className="flex flex-col gap-2.5">
            {sortedFiles.pinned.map((file) => (
              <ArtifactRow key={file.id} file={file} isPinned onTogglePin={togglePin} />
            ))}
            {hasPinned && sortedFiles.unpinned.length > 0 && (
              <div className="mx-3 my-1 border-t border-border/30" />
            )}
            {sortedFiles.unpinned.map((file) => (
              <ArtifactRow key={file.id} file={file} isPinned={false} onTogglePin={togglePin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
