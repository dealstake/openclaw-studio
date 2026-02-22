import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileUpload } from "@/features/agents/hooks/useFileUpload";

function makeFile(name: string, type: string, size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// Mock FileReader for base64 encoding
class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    this.result = "data:image/png;base64,iVBORw0KGgo=";
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  vi.stubGlobal("FileReader", MockFileReader);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
});

describe("useFileUpload", () => {
  it("starts with no files", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.files).toEqual([]);
    expect(result.current.hasFiles).toBe(false);
  });

  it("adds valid image files", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("test.png", "image/png");

    await act(async () => {
      const errors = await result.current.addFiles([file]);
      expect(errors).toEqual([]);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("test.png");
    expect(result.current.files[0].isImage).toBe(true);
    expect(result.current.hasFiles).toBe(true);
  });

  it("rejects files that are too large", async () => {
    const { result } = renderHook(() => useFileUpload());
    const bigFile = makeFile("huge.png", "image/png", 11 * 1024 * 1024);

    await act(async () => {
      const errors = await result.current.addFiles([bigFile]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("too large");
    });

    expect(result.current.files).toHaveLength(0);
  });

  it("rejects unsupported file types", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("test.exe", "application/x-executable");

    await act(async () => {
      const errors = await result.current.addFiles([file]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Unsupported");
    });
  });

  it("removes files by id", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("test.png", "image/png");

    await act(async () => {
      await result.current.addFiles([file]);
    });

    const id = result.current.files[0].id;
    act(() => result.current.removeFile(id));
    expect(result.current.files).toHaveLength(0);
  });

  it("clears all files", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.png", "image/png"),
        makeFile("b.pdf", "application/pdf"),
      ]);
    });

    expect(result.current.files).toHaveLength(2);
    act(() => result.current.clearFiles());
    expect(result.current.files).toHaveLength(0);
  });

  it("getAttachments returns ready files as ChatAttachment[]", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([makeFile("img.png", "image/png")]);
    });

    const attachments = result.current.getAttachments();
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toEqual({
      mimeType: "image/png",
      fileName: "img.png",
      content: "iVBORw0KGgo=",
    });
  });

  it("accepts document types (pdf, txt, csv, json, md)", async () => {
    const { result } = renderHook(() => useFileUpload());
    const docs = [
      makeFile("doc.pdf", "application/pdf"),
      makeFile("notes.txt", "text/plain"),
      makeFile("data.csv", "text/csv"),
      makeFile("config.json", "application/json"),
      makeFile("readme.md", "text/markdown"),
    ];

    await act(async () => {
      const errors = await result.current.addFiles(docs);
      expect(errors).toEqual([]);
    });

    expect(result.current.files).toHaveLength(5);
    // Non-image files should not have isImage set
    expect(result.current.files.every((f) => !f.isImage)).toBe(true);
  });

  it("provides acceptString for file input", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.acceptString).toContain("image/jpeg");
    expect(result.current.acceptString).toContain(".pdf");
  });
});
