import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileUpload } from "@/features/agents/hooks/useFileUpload";

// ── Helpers ────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, size = 100): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// Mock FileReader to resolve instantly
function mockFileReader() {
  const original = globalThis.FileReader;

  class MockFileReader {
    result = "data:image/png;base64,dGVzdA==";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null = null;

    readAsDataURL() {
      if (this.onprogress) {
        this.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
        this.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
      }
      this.onload?.();
    }
  }

  globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  return () => {
    globalThis.FileReader = original;
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useFileUpload", () => {
  let restoreFileReader: () => void;

  beforeEach(() => {
    restoreFileReader = mockFileReader();
    // Mock URL.createObjectURL / revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    restoreFileReader();
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.files).toEqual([]);
    expect(result.current.hasFiles).toBe(false);
    expect(result.current.allReady).toBe(false);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.isEncoding).toBe(false);
  });

  it("adds and encodes an image file", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("test.png", "image/png");

    let errors: string[] | undefined;
    await act(async () => {
      errors = await result.current.addFiles([file]);
    });
    // Flush pending state updates from progress callbacks
    await act(async () => { /* flush */ });

    expect(errors).toEqual([]);
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("test.png");
    expect(result.current.files[0].isImage).toBe(true);
    expect(result.current.files[0].status).toBe("ready");
    expect(result.current.files[0].content).toBe("dGVzdA==");
    expect(result.current.files[0].progress).toBe(100);
    expect(result.current.hasFiles).toBe(true);
    expect(result.current.allReady).toBe(true);
  });

  it("adds a non-image file", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("doc.pdf", "application/pdf");

    await act(async () => {
      await result.current.addFiles([file]);
    });
    await act(async () => { /* flush */ });

    expect(result.current.files[0].isImage).toBe(false);
    expect(result.current.files[0].previewUrl).toBeUndefined();
    expect(result.current.files[0].status).toBe("ready");
  });

  it("rejects files that are too large", async () => {
    const { result } = renderHook(() => useFileUpload());
    const bigFile = makeFile("huge.png", "image/png", 11 * 1024 * 1024);

    await act(async () => {
      const errors = await result.current.addFiles([bigFile]);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toContain("too large");
    });

    expect(result.current.files).toHaveLength(0);
  });

  it("rejects unsupported file types", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("app.exe", "application/x-msdownload");

    await act(async () => {
      const errors = await result.current.addFiles([file]);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toContain("Unsupported");
    });

    expect(result.current.files).toHaveLength(0);
  });

  it("removes a file and revokes preview URL", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = makeFile("test.png", "image/png");

    await act(async () => {
      await result.current.addFiles([file]);
      await new Promise((r) => setTimeout(r, 10));
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.removeFile(fileId);
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.hasFiles).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("clears all files", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([
        makeFile("a.png", "image/png"),
        makeFile("b.png", "image/png"),
      ]);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toHaveLength(0);
  });

  it("getAttachments returns only ready files", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([makeFile("a.png", "image/png")]);
    });

    await act(async () => { /* flush */ });

    const attachments = result.current.getAttachments();
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toEqual({
      mimeType: "image/png",
      fileName: "a.png",
      content: "dGVzdA==",
    });
  });

  it("handles multiple files including mixed valid/invalid", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      const errors = await result.current.addFiles([
        makeFile("good.png", "image/png"),
        makeFile("bad.exe", "application/x-msdownload"),
        makeFile("good.pdf", "application/pdf"),
      ]);
      expect(errors).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.files).toHaveLength(2);
  });

  it("provides correct acceptString", () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.acceptString).toContain("image/jpeg");
    expect(result.current.acceptString).toContain(".pdf");
  });
});

// Need afterEach to be importable
import { afterEach } from "vitest";
