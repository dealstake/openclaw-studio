/**
 * MIME type → icon class name and human-readable label mappings.
 * Pure utility — no React imports.
 *
 * Uses a single config object to avoid duplicated categorization logic.
 */

/** Icon key for use with lucide-react icon components. */
export type FileIconKey =
  | "spreadsheet"
  | "presentation"
  | "document"
  | "form"
  | "image"
  | "code"
  | "text"
  | "file";

interface MimeCategory {
  icon: FileIconKey;
  label: string;
  /** Matcher: exact MIME string, or substring to check with includes(). */
  match: (mime: string) => boolean;
}

/**
 * Ordered list of MIME categories. First match wins.
 * Uses startsWith for broad categories (image/, text/) and exact/includes for specifics.
 */
const MIME_CATEGORIES: MimeCategory[] = [
  // Exact matches first
  {
    icon: "document",
    label: "Google Doc",
    match: (m) => m === "application/vnd.google-apps.document",
  },
  {
    icon: "spreadsheet",
    label: "CSV",
    match: (m) => m === "text/csv",
  },
  // Substring matches for Google/Office types
  {
    icon: "spreadsheet",
    label: "Spreadsheet",
    match: (m) =>
      m.includes("spreadsheet") ||
      m.includes("excel") ||
      m === "application/vnd.ms-excel",
  },
  {
    icon: "presentation",
    label: "Presentation",
    match: (m) => m.includes("presentation") || m.includes("slides"),
  },
  {
    icon: "document",
    label: "Document",
    match: (m) => m.includes("document") || m.includes("word"),
  },
  {
    icon: "form",
    label: "Form",
    match: (m) => m.includes("form"),
  },
  // Broad category: images
  {
    icon: "image",
    label: "Image",
    match: (m) => m.startsWith("image/"),
  },
  // PDF before generic text
  {
    icon: "text",
    label: "PDF",
    match: (m) => m === "application/pdf",
  },
  // Code types
  {
    icon: "code",
    label: "JSON",
    match: (m) => m === "application/json",
  },
  {
    icon: "code",
    label: "JavaScript",
    match: (m) =>
      m === "application/javascript" || m === "text/javascript",
  },
  {
    icon: "code",
    label: "Script",
    match: (m) =>
      m.includes("script") || m.includes("python") || m.includes("shellscript"),
  },
  // Broad category: text
  {
    icon: "text",
    label: "Text",
    match: (m) => m.startsWith("text/"),
  },
];

function findCategory(mime: string): MimeCategory | undefined {
  return MIME_CATEGORIES.find((cat) => cat.match(mime));
}

/** Map a MIME type string to a semantic icon key. */
export function fileIconKey(mime: string): FileIconKey {
  return findCategory(mime)?.icon ?? "file";
}

/** Map a MIME type string to a human-readable label. */
export function fileTypeLabel(mime: string): string {
  return findCategory(mime)?.label ?? "File";
}

/** Format an ISO timestamp for display. */
export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
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
