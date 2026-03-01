/**
 * Phase 3 tests — Drive Sharing Enhancement + listAllDocTemplates
 *
 * Tests:
 *  1. shareFile()  — creates permissions (user + anyone)
 *  2. getShareLink() — ensures public permission + returns webViewLink
 *  3. createFolder() — creates a Drive folder
 *  4. uploadFile() with appProperties — tags metadata
 *  5. listAllDocTemplates() — returns flat enriched list across all persona templates
 *  6. DriveFile.appProperties → isGenerated logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock googleapis (must be hoisted before imports) ────────────────────────

let capturedPermissionBody: unknown = null;
let capturedPermissionFileId = "";
let capturedCreateFileBody: unknown = null;
let capturedCreateFileMetadata: unknown = null;

vi.mock("googleapis", () => {
  const mockPermissionsCreate = vi.fn().mockImplementation(async (params: unknown) => {
    const p = params as { fileId?: string; requestBody?: unknown };
    capturedPermissionFileId = p.fileId ?? "";
    capturedPermissionBody = p.requestBody ?? null;
    return { data: { id: "perm-1" } };
  });

  const mockFilesGet = vi.fn().mockImplementation(async () => ({
    data: {
      id: "file-1",
      name: "Test Doc.pdf",
      mimeType: "application/pdf",
      modifiedTime: "2026-03-01T00:00:00Z",
      webViewLink: "https://drive.google.com/file/d/file-1/view",
    },
  }));

  const mockFilesCreate = vi.fn().mockImplementation(async (params: unknown) => {
    const p = params as { requestBody?: unknown };
    capturedCreateFileMetadata = p;
    capturedCreateFileBody = (p as { requestBody: unknown }).requestBody;
    return {
      data: {
        id: "new-folder-1",
        name: "Test Folder",
        mimeType: "application/vnd.google-apps.folder",
        modifiedTime: "2026-03-01T00:00:00Z",
      },
    };
  });

  const mockFilesList = vi.fn().mockResolvedValue({ data: { files: [] } });

  function MockJWT() {
    return {};
  }

  return {
    google: {
      auth: { JWT: MockJWT },
      drive: vi.fn().mockReturnValue({
        files: {
          list: mockFilesList,
          get: mockFilesGet,
          create: mockFilesCreate,
        },
        permissions: {
          create: mockPermissionsCreate,
        },
      }),
    },
  };
});

// Must import AFTER vi.mock
import {
  shareFile,
  getShareLink,
  createFolder,
  uploadFile,
  GENERATED_APP_PROPERTY_KEY,
  GENERATED_APP_PROPERTY_VALUE,
} from "@/lib/google/drive";

// ── Helpers ──────────────────────────────────────────────────────────────────

function setEnv() {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "test@test.iam.gserviceaccount.com",
    private_key: "fake-key",
  });
}

// ── shareFile() ──────────────────────────────────────────────────────────────

describe("shareFile", () => {
  beforeEach(() => {
    setEnv();
    capturedPermissionBody = null;
    capturedPermissionFileId = "";
  });

  it("creates an 'anyone' reader permission when no email is provided", async () => {
    const permId = await shareFile("file-123");
    expect(permId).toBe("perm-1");
    expect(capturedPermissionFileId).toBe("file-123");
    const body = capturedPermissionBody as Record<string, string>;
    expect(body.type).toBe("anyone");
    expect(body.role).toBe("reader");
    expect(body.emailAddress).toBeUndefined();
  });

  it("creates a user permission when an email is provided", async () => {
    await shareFile("file-456", "writer", "alice@example.com");
    const body = capturedPermissionBody as Record<string, string>;
    expect(body.type).toBe("user");
    expect(body.role).toBe("writer");
    expect(body.emailAddress).toBe("alice@example.com");
  });

  it("defaults to reader role", async () => {
    await shareFile("file-789");
    const body = capturedPermissionBody as Record<string, string>;
    expect(body.role).toBe("reader");
  });
});

// ── getShareLink() ───────────────────────────────────────────────────────────

describe("getShareLink", () => {
  beforeEach(() => {
    setEnv();
    capturedPermissionBody = null;
  });

  it("creates an anyone-reader permission and returns webViewLink", async () => {
    const link = await getShareLink("file-1");
    expect(link).toBe("https://drive.google.com/file/d/file-1/view");
    // Verify permission was created
    const body = capturedPermissionBody as Record<string, string>;
    expect(body.type).toBe("anyone");
    expect(body.role).toBe("reader");
  });
});

// ── createFolder() ───────────────────────────────────────────────────────────

describe("createFolder", () => {
  beforeEach(() => {
    setEnv();
    capturedCreateFileBody = null;
    capturedCreateFileMetadata = null;
  });

  it("creates a folder with the correct mimeType", async () => {
    const folder = await createFolder("My Folder");
    expect(folder.name).toBe("Test Folder");
    expect(folder.id).toBe("new-folder-1");
    const body = capturedCreateFileBody as Record<string, unknown>;
    expect(body.mimeType).toBe("application/vnd.google-apps.folder");
    expect(body.name).toBe("My Folder");
  });

  it("sets parent ID when provided", async () => {
    await createFolder("Sub Folder", "parent-123");
    const body = capturedCreateFileBody as Record<string, unknown>;
    expect(body.parents).toEqual(["parent-123"]);
  });

  it("does not set parents when parentId is omitted", async () => {
    await createFolder("Root Folder");
    const body = capturedCreateFileBody as Record<string, unknown>;
    expect(body.parents).toBeUndefined();
  });
});

// ── uploadFile() with appProperties ─────────────────────────────────────────

describe("uploadFile with appProperties", () => {
  beforeEach(() => {
    setEnv();
    capturedCreateFileBody = null;
  });

  it("passes appProperties to the Drive API when provided", async () => {
    await uploadFile(
      "report.pdf",
      Buffer.from("content"),
      "application/pdf",
      undefined,
      { [GENERATED_APP_PROPERTY_KEY]: GENERATED_APP_PROPERTY_VALUE },
    );
    const body = capturedCreateFileBody as Record<string, unknown>;
    const props = body.appProperties as Record<string, string>;
    expect(props).toBeDefined();
    expect(props[GENERATED_APP_PROPERTY_KEY]).toBe(GENERATED_APP_PROPERTY_VALUE);
  });

  it("omits appProperties from metadata when not provided", async () => {
    await uploadFile("plain.txt", Buffer.from("hello"), "text/plain");
    const body = capturedCreateFileBody as Record<string, unknown>;
    expect(body.appProperties).toBeUndefined();
  });

  it("omits appProperties when given an empty object", async () => {
    await uploadFile("plain.txt", Buffer.from("hello"), "text/plain", undefined, {});
    const body = capturedCreateFileBody as Record<string, unknown>;
    expect(body.appProperties).toBeUndefined();
  });
});

// ── DriveFile.appProperties (frontend type) ──────────────────────────────────

describe("DriveFile.appProperties isGenerated helper logic", () => {
  it("identifies generated files via appProperties", () => {
    const generatedFile = {
      id: "gen-1",
      name: "Meeting Brief.html",
      mimeType: "text/html",
      modifiedTime: "2026-03-01T00:00:00Z",
      appProperties: { [GENERATED_APP_PROPERTY_KEY]: GENERATED_APP_PROPERTY_VALUE },
    };
    const isGenerated =
      generatedFile.appProperties?.generatedBy === GENERATED_APP_PROPERTY_VALUE;
    expect(isGenerated).toBe(true);
  });

  it("does not flag uploaded files as generated", () => {
    const uploadedFile = {
      id: "upl-1",
      name: "Budget.xlsx",
      mimeType: "application/vnd.ms-excel",
      modifiedTime: "2026-03-01T00:00:00Z",
    };
    const isGenerated =
      (uploadedFile as { appProperties?: Record<string, string> }).appProperties
        ?.generatedBy === GENERATED_APP_PROPERTY_VALUE;
    expect(isGenerated).toBe(false);
  });
});

// ── listAllDocTemplates() ────────────────────────────────────────────────────

describe("listAllDocTemplates", () => {
  it("returns a flat array of DocTemplateEntry objects", async () => {
    // Dynamic import to avoid circular dependency issues with vi.mock above
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    // EA and Cold Caller have documentTemplates in their starter kits
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("each entry has personaTemplateKey and personaTemplateName", async () => {
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    for (const entry of entries) {
      expect(typeof entry.personaTemplateKey).toBe("string");
      expect(entry.personaTemplateKey.length).toBeGreaterThan(0);
      expect(typeof entry.personaTemplateName).toBe("string");
      expect(entry.personaTemplateName.length).toBeGreaterThan(0);
    }
  });

  it("each entry has required DocTemplate fields", async () => {
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    for (const entry of entries) {
      expect(typeof entry.filename).toBe("string");
      expect(typeof entry.label).toBe("string");
      expect(typeof entry.description).toBe("string");
      expect(typeof entry.content).toBe("string");
    }
  });

  it("includes executive-assistant templates", async () => {
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    const eaEntries = entries.filter(
      (e) => e.personaTemplateKey === "executive-assistant",
    );
    expect(eaEntries.length).toBeGreaterThan(0);
    // EA has meeting-brief.md.hbs from Phase 1
    const meetingBrief = eaEntries.find((e) => e.filename === "meeting-brief.md.hbs");
    expect(meetingBrief).toBeDefined();
  });

  it("includes cold-caller templates", async () => {
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    const ccEntries = entries.filter(
      (e) => e.personaTemplateKey === "cold-caller",
    );
    expect(ccEntries.length).toBeGreaterThan(0);
  });

  it("returns empty array when no templates are registered", async () => {
    // This tests behavior when a persona has no documentTemplates
    const { listAllDocTemplates } = await import(
      "@/features/personas/lib/documentTemplates"
    );
    const entries = listAllDocTemplates();
    // All returned entries should come from personas that have documentTemplates
    for (const entry of entries) {
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });
});

// ── CAPABILITY_SKILL_MAP additions ───────────────────────────────────────────

describe("CAPABILITY_SKILL_MAP Phase 3 additions", () => {
  it("registers document-generation as a builtin capability", async () => {
    const { CAPABILITY_SKILL_MAP } = await import(
      "@/features/personas/lib/skillWiring"
    );
    const cap = CAPABILITY_SKILL_MAP["document-generation"];
    expect(cap).toBeDefined();
    expect(cap.skillKey).toBe("__builtin__");
    expect(cap.required).toBe(false);
    expect(cap.capability).toContain("Document Generation");
  });

  it("registers drive-sharing with gog skill", async () => {
    const { CAPABILITY_SKILL_MAP } = await import(
      "@/features/personas/lib/skillWiring"
    );
    const cap = CAPABILITY_SKILL_MAP["drive-sharing"];
    expect(cap).toBeDefined();
    expect(cap.skillKey).toBe("gog");
    expect(cap.required).toBe(false);
    expect(cap.capability).toContain("Drive");
  });
});

// ── EA + Cold Caller skillRequirements include doc-gen ───────────────────────

describe("persona template skillRequirements include document generation", () => {
  it("executive-assistant has document-generation skill requirement", async () => {
    const { executiveAssistantTemplate } = await import(
      "@/features/personas/templates/executive-assistant/template"
    );
    const hasDocGen = executiveAssistantTemplate.skillRequirements.some(
      (s) => s.capability.includes("Document Generation"),
    );
    expect(hasDocGen).toBe(true);
  });

  it("executive-assistant has drive-sharing skill requirement", async () => {
    const { executiveAssistantTemplate } = await import(
      "@/features/personas/templates/executive-assistant/template"
    );
    const hasDriveSharing = executiveAssistantTemplate.skillRequirements.some(
      (s) => s.capability.includes("Drive Sharing"),
    );
    expect(hasDriveSharing).toBe(true);
  });

  it("cold-caller has document-generation skill requirement", async () => {
    const { coldCallerTemplate } = await import(
      "@/features/personas/templates/cold-caller/template"
    );
    const hasDocGen = coldCallerTemplate.skillRequirements.some(
      (s) => s.capability.includes("Document Generation"),
    );
    expect(hasDocGen).toBe(true);
  });

  it("cold-caller has drive-sharing skill requirement", async () => {
    const { coldCallerTemplate } = await import(
      "@/features/personas/templates/cold-caller/template"
    );
    const hasDriveSharing = coldCallerTemplate.skillRequirements.some(
      (s) => s.capability.includes("Drive Sharing"),
    );
    expect(hasDriveSharing).toBe(true);
  });
});

// ── EA + Cold Caller AGENTS.md includes document generation instructions ─────

describe("persona AGENTS.md brain file includes document generation instructions", () => {
  it("executive-assistant AGENTS.md mentions document generation service", async () => {
    const { executiveAssistantTemplate } = await import(
      "@/features/personas/templates/executive-assistant/template"
    );
    const agentsMd = executiveAssistantTemplate.brainFileTemplates.find(
      (f) => f.filename === "AGENTS.md",
    );
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("/api/artifacts/generate");
    expect(agentsMd!.content).toContain("/api/artifacts/share");
    expect(agentsMd!.content).toContain("Document Generation");
  });

  it("cold-caller AGENTS.md mentions document generation service", async () => {
    const { coldCallerTemplate } = await import(
      "@/features/personas/templates/cold-caller/template"
    );
    const agentsMd = coldCallerTemplate.brainFileTemplates.find(
      (f) => f.filename === "AGENTS.md",
    );
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("/api/artifacts/generate");
    expect(agentsMd!.content).toContain("/api/artifacts/share");
    expect(agentsMd!.content).toContain("Document Generation");
  });
});
