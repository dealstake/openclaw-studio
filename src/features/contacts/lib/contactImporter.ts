/**
 * Contact CSV Importer
 *
 * Parses a CSV string (or Buffer), maps columns to ContactInput fields,
 * validates each row, and bulk-upserts via contactsRepo (deduplicates by email).
 *
 * Design notes:
 * - Pure utility — no React, no HTTP, easily testable
 * - Uses a hand-rolled parser to avoid runtime dependencies
 * - Column matching is case-insensitive with common aliases
 * - Requires at least `name` OR `email` to consider a row valid
 * - Invalid rows are collected in `errors` (non-throwing); import continues
 */

import type { StudioDb } from "@/lib/database";
import { upsertContact } from "@/lib/database/repositories/contactsRepo";
import type { ContactInput } from "@/lib/database/repositories/contactsRepo";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result summary returned after a CSV import run. */
export interface ImportResult {
  /** Total rows processed (excludes the header row). */
  total: number;
  /** Rows successfully upserted. */
  imported: number;
  /** Rows skipped due to validation errors. */
  skipped: number;
  /** Per-row validation errors (1-indexed, includes column header if available). */
  errors: ImportError[];
}

export interface ImportError {
  /** 1-indexed row number in the CSV (header = row 0). */
  row: number;
  /** Raw CSV row that failed. */
  rawRow: Record<string, string>;
  /** Human-readable reason the row was rejected. */
  reason: string;
}

/** Options for a single import run. */
export interface ImportOptions {
  /** Agent ID that owns the imported contacts. */
  agentId: string;
  /**
   * Persona ID to scope contacts to a specific persona.
   * If omitted, contacts are shared (persona_id = NULL).
   */
  personaId?: string;
  /**
   * Default pipeline stage to assign when the CSV row has no stage column.
   * Defaults to "lead".
   */
  defaultStage?: string;
  /**
   * Comma-separated string or array of tags to append to every imported contact.
   * Merged with any per-row tags in the CSV.
   */
  defaultTags?: string | string[];
  /**
   * Maximum rows to import in a single call (safety cap).
   * Defaults to 5000.
   */
  limit?: number;
}

// ─── Column aliases ───────────────────────────────────────────────────────────

/**
 * Maps normalised column header names to ContactInput field keys.
 * Normalisation: lowercase, strip spaces/hyphens/underscores.
 */
const COLUMN_ALIASES: Record<string, keyof Omit<ContactInput, "id" | "personaId" | "metadata">> = {
  // name
  name: "name",
  fullname: "name",
  fullname_: "name",
  contactname: "name",
  person: "name",
  // email
  email: "email",
  emailaddress: "email",
  email_address: "email",
  // phone
  phone: "phone",
  phonenumber: "phone",
  tel: "phone",
  telephone: "phone",
  mobile: "phone",
  cell: "phone",
  cellphone: "phone",
  // company
  company: "company",
  companyname: "company",
  organization: "company",
  organisation: "company",
  org: "company",
  account: "company",
  accountname: "company",
  // title
  title: "title",
  jobtitle: "title",
  position: "title",
  role: "title",
  // tags
  tags: "tags",
  tag: "tags",
  labels: "tags",
  label: "tags",
  // stage
  stage: "stage",
  pipelinestage: "stage",
  status: "stage",
  leadstatus: "stage",
  // notes
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
  description: "notes",
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects keyed by header row values.
 *
 * Handles:
 * - Quoted fields (including embedded commas and newlines in quotes)
 * - Windows (\\r\\n) and Unix (\\n) line endings
 * - Optional UTF-8 BOM at the start of the string
 * - Empty trailing newline
 * - Semicolon delimiter fallback (auto-detected from header row)
 */
export function parseCsv(raw: string): Record<string, string>[] {
  // Strip BOM
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  // Normalise line endings
  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];

  // Auto-detect delimiter: check header row for semicolons
  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") && !headerLine.includes(",") ? ";" : ",";

  const headers = parseCsvRow(headerLine, delimiter).map((h) => h.trim());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank rows

    const cells = parseCsvRow(line, delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j]?.trim() ?? "";
    }
    results.push(row);
  }

  return results;
}

/**
 * Split a CSV string into logical lines, respecting quoted fields that may
 * span multiple physical lines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // Handle escaped quote ("")
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) && !inQuotes) {
      if (ch === "\r") i++; // consume \n after \r
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) lines.push(current);
  return lines;
}

/**
 * Parse a single CSV row into cells, respecting quoted fields.
 */
function parseCsvRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  cells.push(current);
  return cells;
}

// ─── Column mapper ────────────────────────────────────────────────────────────

/**
 * Normalise a header string for alias lookup:
 * lowercase, remove spaces / hyphens / underscores.
 */
function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[\s\-_]+/g, "");
}

/**
 * Map a raw CSV row (with original header keys) to a partial ContactInput.
 * Returns null if no meaningful fields were found.
 */
function mapRowToContactInput(
  rawRow: Record<string, string>,
  defaultStage: string,
  defaultTags: string[],
  personaId?: string,
): ContactInput | null {
  const mapped: Partial<ContactInput> = {};

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normKey = normaliseHeader(rawKey);
    const field = COLUMN_ALIASES[normKey];
    if (!field || !value) continue;

    if (field === "tags") {
      // Tags can be comma-separated within the cell
      const cellTags = value
        .split(/[,;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const existing = Array.isArray(mapped.tags)
        ? (mapped.tags as string[])
        : [];
      mapped.tags = [...existing, ...cellTags];
    } else {
      (mapped as Record<string, unknown>)[field] = value;
    }
  }

  // Merge default tags
  if (defaultTags.length > 0) {
    const existing = Array.isArray(mapped.tags) ? (mapped.tags as string[]) : [];
    mapped.tags = [...existing, ...defaultTags];
  }

  // Deduplicate tags
  if (Array.isArray(mapped.tags)) {
    mapped.tags = [...new Set(mapped.tags as string[])];
  }

  // Apply default stage if none found
  if (!mapped.stage) {
    mapped.stage = defaultStage;
  }

  // Apply personaId
  if (personaId) {
    mapped.personaId = personaId;
  }

  // Require at least name or email
  if (!mapped.name && !mapped.email) return null;

  // If we only have an email, synthesise a name from it
  if (!mapped.name && mapped.email) {
    mapped.name = mapped.email.split("@")[0].replace(/[._+-]/g, " ");
  }

  return mapped as ContactInput;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Import contacts from a CSV string into the contacts database.
 *
 * @param db       Open StudioDb connection
 * @param csv      Raw CSV text (UTF-8, with or without BOM)
 * @param options  Import options (agentId is required)
 * @returns        Import result summary
 */
export function importContactsFromCsv(
  db: StudioDb,
  csv: string,
  options: ImportOptions,
): ImportResult {
  const {
    agentId,
    personaId,
    defaultStage = "lead",
    defaultTags: rawDefaultTags = [],
    limit = 5_000,
  } = options;

  // Normalise default tags
  const defaultTags: string[] = Array.isArray(rawDefaultTags)
    ? rawDefaultTags.flatMap((t) => t.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean))
    : rawDefaultTags
        .split(/[,;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  const rows = parseCsv(csv);
  const cappedRows = rows.slice(0, limit);

  const result: ImportResult = {
    total: cappedRows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < cappedRows.length; i++) {
    const rawRow = cappedRows[i];
    const rowNum = i + 1; // 1-indexed; header is row 0

    const input = mapRowToContactInput(rawRow, defaultStage, defaultTags, personaId);

    if (!input) {
      result.skipped++;
      result.errors.push({
        row: rowNum,
        rawRow,
        reason: "Row has no name or email — skipped",
      });
      continue;
    }

    try {
      upsertContact(db, agentId, input);
      result.imported++;
    } catch (err) {
      result.skipped++;
      result.errors.push({
        row: rowNum,
        rawRow,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Validate a CSV string without actually importing.
 * Returns a preview of how many valid rows were found and the first few errors.
 */
export function previewCsvImport(
  csv: string,
  options: Pick<ImportOptions, "defaultStage" | "defaultTags" | "personaId" | "limit">,
): { validRows: number; invalidRows: number; errors: ImportError[]; headers: string[] } {
  const {
    defaultStage = "lead",
    defaultTags: rawDefaultTags = [],
    limit = 5_000,
  } = options;

  const defaultTags: string[] = Array.isArray(rawDefaultTags)
    ? rawDefaultTags.flatMap((t) => t.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean))
    : rawDefaultTags
        .split(/[,;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  const rows = parseCsv(csv);
  const cappedRows = rows.slice(0, limit);
  const headers = cappedRows.length > 0 ? Object.keys(cappedRows[0]) : [];

  let validRows = 0;
  let invalidRows = 0;
  const errors: ImportError[] = [];

  for (let i = 0; i < cappedRows.length; i++) {
    const rawRow = cappedRows[i];
    const rowNum = i + 1;
    const input = mapRowToContactInput(
      rawRow,
      defaultStage,
      defaultTags,
      options.personaId,
    );

    if (!input) {
      invalidRows++;
      errors.push({ row: rowNum, rawRow, reason: "Row has no name or email — would be skipped" });
    } else {
      validRows++;
    }
  }

  return { validRows, invalidRows, errors, headers };
}
