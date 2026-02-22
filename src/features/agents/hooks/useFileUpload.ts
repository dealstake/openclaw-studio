import { useCallback, useRef, useState } from "react";

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

const ACCEPTED_TYPES = new Set([
  ...IMAGE_TYPES,
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useFileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const encodingRef = useRef(false);

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
      };
      entries.push(entry);
    }

    if (entries.length === 0) return errors;

    setFiles((prev) => [...prev, ...entries]);

    // Encode all files in parallel
    if (!encodingRef.current) {
      encodingRef.current = true;
    }

    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        try {
          const content = await readFileAsBase64(entry.file);
          return { id: entry.id, content, error: null };
        } catch {
          return { id: entry.id, content: null, error: "Encoding failed" };
        }
      })
    );

    setFiles((prev) =>
      prev.map((f) => {
        const result = results.find(
          (r) => r.status === "fulfilled" && r.value.id === f.id
        );
        if (!result || result.status !== "fulfilled") return f;
        const { content, error } = result.value;
        if (error || !content) {
          return { ...f, status: "error" as const, error: error ?? "Unknown error" };
        }
        return { ...f, status: "ready" as const, content };
      })
    );

    encodingRef.current = false;
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
