/** A file entry from the Google Drive API. */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export type SortDirection = "newest" | "oldest";
