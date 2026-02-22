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
    <div className="relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border border-border/50 bg-muted/30">
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

      {/* Encoding overlay */}
      {isEncoding && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/80 backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-destructive-foreground" />
        </div>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background shadow-sm transition hover:bg-foreground"
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
    <div className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto px-1 pt-1 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0 [scrollbar-width:none]">
      {files.map((file) => (
        <AttachmentThumbnail key={file.id} file={file} onRemove={onRemove} />
      ))}
    </div>
  );
});
