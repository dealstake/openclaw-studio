/**
 * MIME type → icon class name and human-readable label mappings.
 * Pure utility — no React imports.
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

/** Map a MIME type string to a semantic icon key. */
export function fileIconKey(mime: string): FileIconKey {
  if (mime.includes("spreadsheet") || mime.includes("csv") || mime.includes("excel"))
    return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("slides"))
    return "presentation";
  if (mime.includes("document") || mime.includes("word"))
    return "document";
  if (mime.includes("form"))
    return "form";
  if (mime.includes("image"))
    return "image";
  if (
    mime.includes("script") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("python") ||
    mime.includes("shellscript")
  )
    return "code";
  if (mime.includes("text") || mime.includes("plain") || mime.includes("pdf"))
    return "text";
  return "file";
}

/** Map a MIME type string to a human-readable label. */
export function fileTypeLabel(mime: string): string {
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

/** Format an ISO timestamp for display. */
export function formatTimestamp(iso: string): string {
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
