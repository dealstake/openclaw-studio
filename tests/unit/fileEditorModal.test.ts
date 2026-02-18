import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileEditorModal } from "@/components/FileEditorModal";

afterEach(cleanup);

const mockFetch = vi.fn();
global.fetch = mockFetch;
vi.spyOn(window, "confirm").mockReturnValue(true);

function renderModal(
  props: Partial<Parameters<typeof FileEditorModal>[0]> = {}
) {
  return render(
    createElement(FileEditorModal, {
      open: true,
      onOpenChange: () => {},
      agentId: "alex",
      filePath: "projects/test.md",
      ...props,
    })
  );
}

describe("FileEditorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "# Hello World" }),
    });
  });

  it("renders content in preview mode after loading", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeDefined();
    });
  });

  it("does not render content when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByText("Preview")).toBeNull();
  });

  it("shows error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load file: 404/)).toBeDefined();
    });
  });

  it("shows file path in header", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getAllByText("test.md").length).toBeGreaterThan(0);
    });
  });

  it("switches to edit mode and shows textarea", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByTestId("file-editor-textarea")).toBeDefined();
  });

  it("tracks dirty state", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByTestId("file-editor-textarea"), {
      target: { value: "changed" },
    });
    expect(screen.getByText("Unsaved changes")).toBeDefined();
  });
});
