import { memo } from "react";
import { AlertCircle, FileText, X } from "lucide-react";
import type { UploadedFile } from "../hooks/useFileUpload";

// ── Single Thumbnail ───────────────────────────────────────────────────

const AttachmentThumbnail = memo(function AttachmentThumbnail({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: (id: string) => void;
}) {
  const isEncoding = file.status === "encoding";
  const isError = file.status === "error";

  return (
    <div
      className="group relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border border-border/50 bg-muted/30"
      title={isError ? file.error ?? "Upload failed" : file.name}
    >
      {/* Content */}
      {file.isImage && file.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.previewUrl}
          alt={file.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="max-w-full truncate text-[9px] text-muted-foreground">
            {file.name.split(".").pop()?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Encoding overlay with progress */}
      {isEncoding && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 backdrop-blur-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {file.progress > 0 && file.progress < 100 && (
            <span className="text-[9px] font-medium text-foreground">
              {file.progress}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar at bottom */}
      {isEncoding && file.progress > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${file.progress}%` }}
          />
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-destructive/80 backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-destructive-foreground" />
          <span className="max-w-[56px] truncate text-[8px] text-destructive-foreground">
            {file.error ?? "Failed"}
          </span>
        </div>
      )}

      {/* Remove button — larger touch target on mobile */}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/80 text-background shadow-sm transition hover:bg-foreground sm:h-6 sm:w-6 sm:min-h-[44px] sm:min-w-[44px]"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
});

// ── Preview Container ──────────────────────────────────────────────────

export const ChatAttachmentPreview = memo(function ChatAttachmentPreview({
  files,
  onRemove,
}: {
  files: UploadedFile[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div role="group" aria-label="File attachments" className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto px-1 pt-1 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0 [scrollbar-width:none]">
      {files.map((file) => (
        <AttachmentThumbnail key={file.id} file={file} onRemove={onRemove} />
      ))}
    </div>
  );
});
