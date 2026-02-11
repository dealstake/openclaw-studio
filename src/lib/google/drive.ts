import { google, type drive_v3 } from "googleapis";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";

// ── Auth ───────────────────────────────────────────────────────────────────────

let cachedDrive: drive_v3.Drive | null = null;

function getServiceAccountCredentials(): Record<string, unknown> {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline) as Record<string, unknown>;
  }

  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  }

  throw new Error(
    "Google Drive not configured: set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE"
  );
}

/**
 * Get an authenticated Google Drive v3 client using service account credentials.
 * The client is cached for the process lifetime.
 */
export function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const credentials = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

/**
 * Get a Drive client authenticated with a user's OAuth access token.
 * (Stub for future per-user OAuth via CF Access JWT.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDriveClientWithToken(_accessToken: string): drive_v3.Drive {
  // TODO: Implement per-user OAuth when CF Access JWT integration is ready
  throw new Error("OAuth token auth not yet implemented");
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
 * Download file content. Returns a readable stream.
 * For Google Workspace files (Docs, Sheets, etc.), exports as PDF.
 */
export async function downloadFile(
  fileId: string,
  exportMimeType?: string
): Promise<{ stream: Readable; mimeType: string }> {
  const drive = getDriveClient();

  // Check if it's a Google Workspace file that needs export
  const meta = await drive.files.get({
    fileId,
    fields: "mimeType",
    supportsAllDrives: true,
  });

  const mime = meta.data.mimeType ?? "";
  if (mime.startsWith("application/vnd.google-apps.")) {
    const exportMime = exportMimeType ?? "application/pdf";
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: "stream" }
    );
    return { stream: res.data as unknown as Readable, mimeType: exportMime };
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return { stream: res.data as unknown as Readable, mimeType: mime };
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
 * Create a folder in Google Drive.
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = getDriveClient();

  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const res = await drive.files.create({
    requestBody: fileMetadata,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return mapFile(res.data);
}

/**
 * Move a file to trash.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

/**
 * Search files by name or full-text content.
 */
export async function searchFiles(
  searchQuery: string,
  pageSize = 50
): Promise<DriveFile[]> {
  const drive = getDriveClient();

  const q = `trashed = false and (name contains '${searchQuery.replace(/'/g, "\\'")}' or fullText contains '${searchQuery.replace(/'/g, "\\'")}')`;

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
