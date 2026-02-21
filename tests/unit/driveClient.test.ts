import { describe, it, expect, vi, beforeEach } from "vitest";

// We can't easily mock googleapis at module level, so we test the pure helpers
// by importing them indirectly. Instead, we test the sanitizeDriveQuery logic
// and mapFile by extracting testable behavior.

// Since drive.ts doesn't export sanitizeDriveQuery or mapFile directly,
// we test the exported functions via mocked googleapis.

// Mock googleapis before importing drive module
const mockFilesList = vi.fn();
const mockFilesGet = vi.fn();
const mockFilesCreate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function(this: Record<string, unknown>) { return this; }),
    },
    drive: vi.fn(() => ({
      files: {
        list: mockFilesList,
        get: mockFilesGet,
        create: mockFilesCreate,
      },
    })),
  },
}));

// Set required env vars before importing
vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({
  client_email: "test@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
}));

// Dynamic import after mocks
const { listFiles, getFile, searchFiles } = await import("@/lib/google/drive");

describe("drive.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listFiles", () => {
    it("builds query without folderId", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [], nextPageToken: undefined } });
      await listFiles();
      expect(mockFilesList).toHaveBeenCalledWith(
        expect.objectContaining({ q: "trashed = false" })
      );
    });

    it("builds query with folderId (sanitized)", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [], nextPageToken: undefined } });
      await listFiles({ folderId: "folder123" });
      expect(mockFilesList).toHaveBeenCalledWith(
        expect.objectContaining({ q: "trashed = false and 'folder123' in parents" })
      );
    });

    it("sanitizes folderId with single quotes", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [], nextPageToken: undefined } });
      await listFiles({ folderId: "it's a test" });
      const call = mockFilesList.mock.calls[0][0];
      expect(call.q).toBe("trashed = false and 'it\\'s a test' in parents");
    });

    it("sanitizes folderId with backslashes", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [], nextPageToken: undefined } });
      await listFiles({ folderId: "path\\to\\folder" });
      const call = mockFilesList.mock.calls[0][0];
      expect(call.q).toBe("trashed = false and 'path\\\\to\\\\folder' in parents");
    });

    it("appends custom query", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [], nextPageToken: undefined } });
      await listFiles({ query: "mimeType = 'text/plain'" });
      const call = mockFilesList.mock.calls[0][0];
      expect(call.q).toBe("trashed = false and mimeType = 'text/plain'");
    });

    it("maps file results correctly", async () => {
      mockFilesList.mockResolvedValue({
        data: {
          files: [
            { id: "f1", name: "doc.txt", mimeType: "text/plain", modifiedTime: "2026-01-01T00:00:00Z", size: "1024" },
          ],
          nextPageToken: "token123",
        },
      });
      const result = await listFiles();
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual({
        id: "f1",
        name: "doc.txt",
        mimeType: "text/plain",
        modifiedTime: "2026-01-01T00:00:00Z",
        size: "1024",
        webViewLink: undefined,
        createdTime: undefined,
        parents: undefined,
      });
      expect(result.nextPageToken).toBe("token123");
    });

    it("handles missing file fields with defaults", async () => {
      mockFilesList.mockResolvedValue({
        data: { files: [{}], nextPageToken: null },
      });
      const result = await listFiles();
      expect(result.files[0].id).toBe("");
      expect(result.files[0].name).toBe("Untitled");
      expect(result.files[0].mimeType).toBe("application/octet-stream");
    });

    it("passes pagination params", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [] } });
      await listFiles({ pageSize: 50, pageToken: "abc", orderBy: "name asc" });
      expect(mockFilesList).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 50, pageToken: "abc", orderBy: "name asc" })
      );
    });
  });

  describe("getFile", () => {
    it("fetches file by ID", async () => {
      mockFilesGet.mockResolvedValue({
        data: { id: "f1", name: "test.txt", mimeType: "text/plain", modifiedTime: "2026-01-01T00:00:00Z" },
      });
      const file = await getFile("f1");
      expect(file.id).toBe("f1");
      expect(mockFilesGet).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: "f1", supportsAllDrives: true })
      );
    });
  });

  describe("searchFiles", () => {
    it("sanitizes search query", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [] } });
      await searchFiles("test's file");
      const call = mockFilesList.mock.calls[0][0];
      expect(call.q).toContain("test\\'s file");
    });

    it("searches name and fullText", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [] } });
      await searchFiles("hello");
      const call = mockFilesList.mock.calls[0][0];
      expect(call.q).toContain("name contains 'hello'");
      expect(call.q).toContain("fullText contains 'hello'");
    });
  });
});
