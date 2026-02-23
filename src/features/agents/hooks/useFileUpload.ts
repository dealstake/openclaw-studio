import { useCallback, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────

export type FileUploadStatus = "pending" | "encoding" | "ready" | "error";

export type UploadedFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  status: FileUploadStatus;
  /** base64 content (set after encoding) */
  content?: string;
  /** preview URL for images */
  previewUrl?: string;
  /** error message if encoding failed */
  error?: string;
  /** encoding progress 0-100 */
  progress: number;
};

export type ChatAttachment = {
  mimeType: string;
  fileName: string;
  content: string; // base64
};

// ── Constants ──────────────────────────────────────────────────────────

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

/** Raster types eligible for client-side resize. SVG and GIF are excluded
 *  (SVGs are resolution-independent; GIFs may be animated). */
const RESIZABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ACCEPTED_TYPES = new Set([
  ...IMAGE_TYPES,
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Maximum image dimension (longest side) for client-side resizing.
 *
 * Images larger than this are scaled down before base64 encoding, so the
 * gateway stores an already-conformant image and never re-resizes it on
 * subsequent model turns.
 *
 * MUST match (or be ≤) the gateway's `imageMaxDimensionPx` config (768).
 * When client sends 1200px and gateway config is 768px, the server still
 * re-resizes on every turn — observed: 350 redundant resize ops/day.
 */
const IMAGE_MAX_DIMENSION_PX = 768;

/** JPEG quality for client-side resize output (0-1). */
const IMAGE_RESIZE_QUALITY = 0.85;

const ACCEPT_STRING =
  "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,.pdf,.txt,.md,.csv,.json";

// ── Helpers ────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId() {
  return `upload-${Date.now()}-${++idCounter}`;
}

function isImageType(mime: string): boolean {
  return IMAGE_TYPES.has(mime);
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`;
  }
  // Allow any type that starts with image/ or is in accepted set
  if (!ACCEPTED_TYPES.has(file.type) && !file.type.startsWith("image/")) {
    return `Unsupported file type: ${file.type || "unknown"}`;
  }
  return null;
}

function readFileAsBase64(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.onload = () => {
      onProgress?.(100);
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize a raster image to fit within {@link IMAGE_MAX_DIMENSION_PX} using
 * an OffscreenCanvas (or regular Canvas as fallback). Returns the resized
 * base64 and the output MIME type. If the image already fits, returns the
 * original base64 unchanged.
 *
 * This prevents the gateway from re-resizing the same oversized image on
 * every model turn (752 redundant resize ops observed in one day).
 */
async function resizeImageIfNeeded(
  base64: string,
  mimeType: string,
): Promise<{ base64: string; mimeType: string }> {
  if (!RESIZABLE_IMAGE_TYPES.has(mimeType)) return { base64, mimeType };

  // Decode to an ImageBitmap to read natural dimensions without painting to DOM
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    // If we can't decode the image, return it unchanged — the gateway
    // will handle it (or error gracefully).
    return { base64, mimeType };
  }

  const { width, height } = bmp;
  const maxSide = Math.max(width, height);

  if (maxSide <= IMAGE_MAX_DIMENSION_PX) {
    bmp.close();
    return { base64, mimeType };
  }

  // Scale down proportionally
  const scale = IMAGE_MAX_DIMENSION_PX / maxSide;
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  // Use OffscreenCanvas when available (Web Workers friendly, no DOM needed)
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(newWidth, newHeight);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
  }

  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) {
    bmp.close();
    return { base64, mimeType };
  }

  ctx.drawImage(bmp, 0, 0, newWidth, newHeight);
  bmp.close();

  // Export as JPEG — the gateway's resize pipeline also outputs JPEG,
  // so this keeps the format consistent and avoids double-conversion.
  const outputMime = "image/jpeg";
  let outputBlob: Blob;
  if (canvas instanceof OffscreenCanvas) {
    outputBlob = await canvas.convertToBlob({ type: outputMime, quality: IMAGE_RESIZE_QUALITY });
  } else {
    outputBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        outputMime,
        IMAGE_RESIZE_QUALITY,
      );
    });
  }

  const outputBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
    };
    reader.onerror = () => reject(new Error("Failed to encode resized image"));
    reader.readAsDataURL(outputBlob);
  });

  return { base64: outputBase64, mimeType: outputMime };
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useFileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const entries: UploadedFile[] = [];
    const errors: string[] = [];

    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        continue;
      }
      const isImg = isImageType(file.type);
      const entry: UploadedFile = {
        id: nextId(),
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        isImage: isImg,
        status: "encoding",
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        progress: 0,
      };
      entries.push(entry);
    }

    if (entries.length === 0) return errors;

    setFiles((prev) => [...prev, ...entries]);

    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        try {
          const raw = await readFileAsBase64(entry.file, (pct) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f))
            );
          });

          // Resize oversized images client-side so the gateway stores them
          // at the target dimensions. This avoids the gateway re-resizing
          // the same image on every subsequent model turn.
          let content = raw;
          let mimeType = entry.mimeType;
          if (entry.isImage && RESIZABLE_IMAGE_TYPES.has(entry.mimeType)) {
            const resized = await resizeImageIfNeeded(raw, entry.mimeType);
            content = resized.base64;
            mimeType = resized.mimeType;
          }

          return { id: entry.id, content, mimeType, error: null };
        } catch {
          return { id: entry.id, content: null, mimeType: entry.mimeType, error: "Encoding failed" };
        }
      })
    );

    setFiles((prev) =>
      prev.map((f) => {
        const result = results.find(
          (r) => r.status === "fulfilled" && r.value.id === f.id
        );
        if (!result || result.status !== "fulfilled") return f;
        const { content, mimeType, error } = result.value;
        if (error || !content) {
          return { ...f, status: "error" as const, error: error ?? "Unknown error", progress: 0 };
        }
        return { ...f, status: "ready" as const, content, mimeType, progress: 100 };
      })
    );

    return errors;
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      for (const f of prev) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
      return [];
    });
  }, []);

  const getAttachments = useCallback((): ChatAttachment[] => {
    return files
      .filter((f) => f.status === "ready" && f.content)
      .map((f) => ({
        mimeType: f.mimeType,
        fileName: f.name,
        content: f.content!,
      }));
  }, [files]);

  const hasFiles = files.length > 0;
  const allReady = files.length > 0 && files.every((f) => f.status === "ready");
  const hasErrors = files.some((f) => f.status === "error");
  const isEncoding = files.some((f) => f.status === "encoding");

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    getAttachments,
    hasFiles,
    allReady,
    hasErrors,
    isEncoding,
    acceptString: ACCEPT_STRING,
  };
}
