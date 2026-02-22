import { describe, it, expect } from "vitest";
import { fileIconKey, fileTypeLabel, formatTimestamp } from "@/features/artifacts/lib/fileTypes";

describe("fileIconKey", () => {
  it("maps spreadsheet MIME types", () => {
    expect(fileIconKey("application/vnd.google-apps.spreadsheet")).toBe("spreadsheet");
    expect(fileIconKey("text/csv")).toBe("spreadsheet");
    expect(fileIconKey("application/vnd.ms-excel")).toBe("spreadsheet");
  });

  it("maps presentation MIME types", () => {
    expect(fileIconKey("application/vnd.google-apps.presentation")).toBe("presentation");
    expect(fileIconKey("application/vnd.openxmlformats-officedocument.presentationml.slides")).toBe("presentation");
  });

  it("maps document MIME types", () => {
    expect(fileIconKey("application/vnd.google-apps.document")).toBe("document");
    expect(fileIconKey("application/msword")).toBe("document");
  });

  it("maps form MIME types", () => {
    expect(fileIconKey("application/vnd.google-apps.form")).toBe("form");
  });

  it("maps image MIME types", () => {
    expect(fileIconKey("image/png")).toBe("image");
    expect(fileIconKey("image/jpeg")).toBe("image");
  });

  it("maps code MIME types", () => {
    expect(fileIconKey("application/javascript")).toBe("code");
    expect(fileIconKey("application/json")).toBe("code");
    expect(fileIconKey("text/x-python")).toBe("code");
    expect(fileIconKey("application/x-shellscript")).toBe("code");
  });

  it("maps text/plain and pdf to text", () => {
    expect(fileIconKey("text/plain")).toBe("text");
    expect(fileIconKey("application/pdf")).toBe("text");
  });

  it("returns file for unknown MIME types", () => {
    expect(fileIconKey("application/octet-stream")).toBe("file");
    expect(fileIconKey("")).toBe("file");
  });
});

describe("fileTypeLabel", () => {
  it("returns human-readable labels", () => {
    expect(fileTypeLabel("application/vnd.google-apps.spreadsheet")).toBe("Spreadsheet");
    expect(fileTypeLabel("text/csv")).toBe("CSV");
    expect(fileTypeLabel("application/vnd.google-apps.document")).toBe("Google Doc");
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(fileTypeLabel("image/png")).toBe("Image");
    expect(fileTypeLabel("application/json")).toBe("JSON");
    expect(fileTypeLabel("text/plain")).toBe("Text");
    expect(fileTypeLabel("application/octet-stream")).toBe("File");
  });
});

describe("formatTimestamp", () => {
  it("formats a valid ISO string", () => {
    const result = formatTimestamp("2026-01-15T10:30:00Z");
    // Result varies by locale but should contain "Jan" and "15"
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("returns the original string on invalid input", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
