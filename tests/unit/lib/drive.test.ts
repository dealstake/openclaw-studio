import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Drive query sanitization in searchFiles().
 * We mock googleapis to avoid actual API calls and verify the query string.
 */

// Capture the query passed to drive.files.list
let capturedQuery = "";

vi.mock("googleapis", () => {
  const mockList = vi.fn().mockImplementation(async (params: { q?: string }) => {
    capturedQuery = params.q ?? "";
    return { data: { files: [] } };
  });

  // JWT must be a real constructor (called with `new`)
  function MockJWT() { return {}; }

  return {
    google: {
      auth: { JWT: MockJWT },
      drive: vi.fn().mockReturnValue({
        files: {
          list: mockList,
          get: vi.fn(),
          create: vi.fn(),
        },
      }),
    },
  };
});

// Must import AFTER vi.mock
import { searchFiles, listFiles, getFile, uploadFile } from "@/lib/google/drive";

// Get mock references for assertions
const { google: mockGoogle } = await import("googleapis");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDrive = (mockGoogle.drive as any)() as unknown as {
  files: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe("searchFiles query sanitization", () => {
  beforeEach(() => {
    capturedQuery = "";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "test@test.iam.gserviceaccount.com",
      private_key: "fake-key",
    });
  });

  it("handles normal search queries", async () => {
    await searchFiles("budget report");
    expect(capturedQuery).toContain("name contains 'budget report'");
    expect(capturedQuery).toContain("fullText contains 'budget report'");
  });

  it("escapes single quotes to prevent injection", async () => {
    await searchFiles("it's a test");
    expect(capturedQuery).toContain("name contains 'it\\'s a test'");
  });

  it("escapes backslashes before single quotes", async () => {
    await searchFiles("path\\file");
    expect(capturedQuery).toContain("name contains 'path\\\\file'");
  });

  it("handles combined backslash + quote injection attempt", async () => {
    // Attacker tries: \' to escape the escape and break out of the string
    await searchFiles("trick\\' or name contains '");
    // Backslash is escaped first → \\, then quote → \'
    // Result: trick\\\\\\' or name contains \\'
    expect(capturedQuery).not.toContain("' or name contains '");
    // The entire input should be safely inside the quotes
    expect(capturedQuery).toContain("trashed = false");
  });

  it("handles empty query", async () => {
    await searchFiles("");
    expect(capturedQuery).toContain("name contains ''");
  });
});

describe("listFiles", () => {
  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "test@test.iam.gserviceaccount.com",
      private_key: "fake-key",
    });
  });

  it("returns mapped files with defaults", async () => {
    mockDrive.files.list.mockResolvedValueOnce({
      data: {
        files: [
          { id: "f1", name: "Doc.pdf", mimeType: "application/pdf", modifiedTime: "2026-01-01T00:00:00Z" },
        ],
        nextPageToken: "tok2",
      },
    });

    const result = await listFiles();
    expect(result.files).toHaveLength(1);
    expect(result.files[0].id).toBe("f1");
    expect(result.files[0].name).toBe("Doc.pdf");
    expect(result.nextPageToken).toBe("tok2");
  });

  it("builds query with folderId", async () => {
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

    await listFiles({ folderId: "folder123" });
    const call = mockDrive.files.list.mock.calls.at(-1)?.[0];
    expect(call.q).toContain("'folder123' in parents");
  });

  it("appends custom query", async () => {
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

    await listFiles({ query: "mimeType = 'application/pdf'" });
    const call = mockDrive.files.list.mock.calls.at(-1)?.[0];
    expect(call.q).toContain("mimeType = 'application/pdf'");
  });

  it("handles empty file list", async () => {
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: null } });

    const result = await listFiles();
    expect(result.files).toEqual([]);
    expect(result.nextPageToken).toBeUndefined();
  });
});

describe("getFile", () => {
  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "test@test.iam.gserviceaccount.com",
      private_key: "fake-key",
    });
  });

  it("returns mapped file metadata", async () => {
    mockDrive.files.get.mockResolvedValueOnce({
      data: {
        id: "f1",
        name: "Report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        modifiedTime: "2026-02-01T12:00:00Z",
        size: "1024",
        webViewLink: "https://drive.google.com/file/d/f1/view",
      },
    });

    const file = await getFile("f1");
    expect(file.id).toBe("f1");
    expect(file.name).toBe("Report.docx");
    expect(file.size).toBe("1024");
    expect(file.webViewLink).toContain("drive.google.com");
  });

  it("fills defaults for missing fields", async () => {
    mockDrive.files.get.mockResolvedValueOnce({
      data: { id: null, name: null, mimeType: null, modifiedTime: null },
    });

    const file = await getFile("f2");
    expect(file.id).toBe("");
    expect(file.name).toBe("Untitled");
    expect(file.mimeType).toBe("application/octet-stream");
  });
});

describe("uploadFile", () => {
  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "test@test.iam.gserviceaccount.com",
      private_key: "fake-key",
    });
  });

  it("uploads a file and returns mapped result", async () => {
    mockDrive.files.create.mockResolvedValueOnce({
      data: {
        id: "new1",
        name: "upload.txt",
        mimeType: "text/plain",
        modifiedTime: "2026-02-20T00:00:00Z",
        parents: ["folderA"],
      },
    });

    const file = await uploadFile("upload.txt", Buffer.from("hello"), "text/plain", "folderA");
    expect(file.id).toBe("new1");
    expect(file.name).toBe("upload.txt");
    expect(file.parents).toEqual(["folderA"]);

    const call = mockDrive.files.create.mock.calls[0][0];
    expect(call.requestBody.parents).toEqual(["folderA"]);
  });

  it("uploads without folderId", async () => {
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: "new2", name: "file.bin", mimeType: "application/octet-stream", modifiedTime: "2026-02-20T00:00:00Z" },
    });

    await uploadFile("file.bin", Buffer.from("data"), "application/octet-stream");
    const call = mockDrive.files.create.mock.calls.at(-1)?.[0];
    expect(call.requestBody.parents).toBeUndefined();
  });
});
