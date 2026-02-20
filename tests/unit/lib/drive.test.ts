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
import { searchFiles } from "@/lib/google/drive";

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
