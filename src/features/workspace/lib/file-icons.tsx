"use client";

import {
  Braces,
  Calendar,
  ClipboardList,
  Code2,
  File,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Terminal,
} from "lucide-react";

import type { WorkspaceEntry } from "../types";

/** Common icon class — 16px, flex-shrink-0 */
const CLS = "h-4 w-4 flex-shrink-0";

/**
 * Returns the appropriate Lucide icon element for a workspace entry.
 *
 * Directories get folder icons (special names get unique icons).
 * Files are matched by extension — unknown types fall back to a generic File icon.
 *
 * @param entry  Minimal entry shape (name + type)
 * @param isExpanded  Whether a directory is currently open (swaps Folder → FolderOpen)
 */
export function getFileIcon(
  entry: Pick<WorkspaceEntry, "name" | "type">,
  isExpanded = false
): React.ReactElement {
  // ── Directories ────────────────────────────────────────────────────────────
  if (entry.type === "directory") {
    if (entry.name === "projects") {
      return <ClipboardList className={`${CLS} text-muted-foreground`} />;
    }
    if (entry.name === "memory") {
      return <Calendar className={`${CLS} text-muted-foreground`} />;
    }
    return isExpanded
      ? <FolderOpen className={`${CLS} text-amber-400`} />
      : <Folder className={`${CLS} text-muted-foreground`} />;
  }

  // ── Files — match by lowercase extension ──────────────────────────────────
  const lower = entry.name.toLowerCase();

  // Markdown / plain text
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) {
    return <FileText className={`${CLS} text-blue-400`} />;
  }
  if (lower.endsWith(".txt")) {
    return <FileText className={`${CLS} text-muted-foreground`} />;
  }

  // TypeScript / JavaScript
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return <FileCode className={`${CLS} text-sky-400`} />;
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return <FileCode className={`${CLS} text-yellow-400`} />;
  }

  // Data / config
  if (lower.endsWith(".json") || lower.endsWith(".jsonc")) {
    return <Braces className={`${CLS} text-green-400`} />;
  }
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return <Braces className={`${CLS} text-orange-400`} />;
  }
  if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".env")) {
    return <Braces className={`${CLS} text-orange-300`} />;
  }

  // Shell scripts
  if (
    lower.endsWith(".sh") ||
    lower.endsWith(".bash") ||
    lower.endsWith(".zsh") ||
    lower.endsWith(".fish")
  ) {
    return <Terminal className={`${CLS} text-emerald-400`} />;
  }

  // Styles
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass") || lower.endsWith(".less")) {
    return <Code2 className={`${CLS} text-pink-400`} />;
  }

  // Images
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".ico")
  ) {
    return <FileImage className={`${CLS} text-purple-400`} />;
  }

  // Other code
  if (lower.endsWith(".py")) {
    return <FileCode className={`${CLS} text-yellow-300`} />;
  }
  if (lower.endsWith(".sql")) {
    return <FileCode className={`${CLS} text-cyan-400`} />;
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return <Code2 className={`${CLS} text-orange-400`} />;
  }
  if (lower.endsWith(".xml")) {
    return <Code2 className={`${CLS} text-muted-foreground`} />;
  }

  // Fallback
  return <File className={`${CLS} text-muted-foreground`} />;
}
