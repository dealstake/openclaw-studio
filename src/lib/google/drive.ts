import { google, type drive_v3 } from "googleapis";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";

// ── Auth ───────────────────────────────────────────────────────────────────────

let cachedDrive: drive_v3.Drive | null = null;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

function getServiceAccountCredentials(): ServiceAccountKey {
  // Try inline JSON (plain or base64-encoded)
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    const trimmed = inline.trim();
    // If it starts with '{', it's plain JSON; otherwise assume base64
    const json = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf-8");
    return JSON.parse(json) as ServiceAccountKey;
  }

  // Try file path
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ServiceAccountKey;
  }

  throw new Error(
    "Google Drive not configured: set GOOGLE_SERVICE_ACCOUNT_JSON (plain or base64) or GOOGLE_SERVICE_ACCOUNT_FILE"
  );
}

/**
 * Get an authenticated Google Drive v3 client using service account credentials
 * with domain-wide delegation (impersonating GOOGLE_IMPERSONATE_EMAIL).
 * The client is cached for the process lifetime.
 */
function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const credentials = getServiceAccountCredentials();
  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: impersonateEmail || undefined,
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  createdTime?: string;
  parents?: string[];
}

export interface ListFilesOptions {
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  query?: string;
}

export interface ListFilesResult {
  files: DriveFile[];
  nextPageToken?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const FILE_FIELDS = "id, name, mimeType, modifiedTime, size, webViewLink, createdTime, parents";

function mapFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id ?? "",
    name: f.name ?? "Untitled",
    mimeType: f.mimeType ?? "application/octet-stream",
    modifiedTime: f.modifiedTime ?? new Date().toISOString(),
    size: f.size ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    createdTime: f.createdTime ?? undefined,
    parents: (f.parents as string[] | undefined) ?? undefined,
  };
}

// ── API Functions ──────────────────────────────────────────────────────────────

/**
 * List files in Google Drive with optional pagination, sorting, and filtering.
 */
export async function listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
  const drive = getDriveClient();
  const {
    folderId,
    pageSize = 100,
    pageToken,
    orderBy = "modifiedTime desc",
    query,
  } = options;

  let q = "trashed = false";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  if (query) {
    q += ` and ${query}`;
  }

  const res = await drive.files.list({
    q,
    pageSize,
    pageToken: pageToken ?? undefined,
    orderBy,
    fields: `nextPageToken, files(${FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    files: (res.data.files ?? []).map(mapFile),
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

/**
 * Get file metadata by ID.
 */
export async function getFile(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });
  return mapFile(res.data);
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadFile(
  name: string,
  content: Buffer | Readable,
  mimeType: string,
  folderId?: string
): Promise<DriveFile> {
  const drive = getDriveClient();

  const fileMetadata: drive_v3.Schema$File = { name };
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType,
    body: content instanceof Buffer ? Readable.from(content) : content,
  };

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return mapFile(res.data);
}

/**
 * Search files by name or full-text content.
 */
export async function searchFiles(
  searchQuery: string,
  pageSize = 50
): Promise<DriveFile[]> {
  const drive = getDriveClient();

  // Sanitize for Drive API query: escape backslashes first, then single quotes
  const sanitized = searchQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `trashed = false and (name contains '${sanitized}' or fullText contains '${sanitized}')`;

  const res = await drive.files.list({
    q,
    pageSize,
    orderBy: "modifiedTime desc",
    fields: `files(${FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files ?? []).map(mapFile);
}
