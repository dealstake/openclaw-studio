import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { classifyEntry, type WorkspaceEntry } from "@/features/workspace/types";

// ── classifyEntry ──

describe("classifyEntry", () => {
  it("classifies projects directory", () => {
    expect(classifyEntry({ name: "projects", path: "projects", type: "directory" })).toBe("projects");
  });

  it("classifies file inside projects/", () => {
    expect(classifyEntry({ name: "foo.md", path: "projects/foo.md", type: "file" })).toBe("projects");
  });

  it("classifies memory directory", () => {
    expect(classifyEntry({ name: "memory", path: "memory", type: "directory" })).toBe("memory");
  });

  it("classifies file inside memory/", () => {
    expect(classifyEntry({ name: "2026-02-25.md", path: "memory/2026-02-25.md", type: "file" })).toBe("memory");
  });

  it("classifies brain files at root", () => {
    const brainFiles = ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md", "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md"];
    for (const name of brainFiles) {
      expect(classifyEntry({ name, path: name, type: "file" })).toBe("brain");
    }
  });

  it("classifies unknown files as other", () => {
    expect(classifyEntry({ name: "README.md", path: "README.md", type: "file" })).toBe("other");
  });

  it("classifies directories not matching known groups as other", () => {
    expect(classifyEntry({ name: "scripts", path: "scripts", type: "directory" })).toBe("other");
  });
});

// ── WorkspaceExplorerPanel ──

// Mock the heavy hooks so we can test the component rendering paths
vi.mock("@/features/workspace/hooks/useWorkspaceFiles", () => ({
  useWorkspaceFiles: vi.fn(),
}));
vi.mock("@/features/workspace/hooks/useProjectStatuses", () => ({
  useProjectStatuses: vi.fn().mockReturnValue(new Map()),
}));

import { useWorkspaceFiles } from "@/features/workspace/hooks/useWorkspaceFiles";
import { WorkspaceExplorerPanel } from "@/features/workspace/components/WorkspaceExplorerPanel";

const mockUseWorkspaceFiles = vi.mocked(useWorkspaceFiles);

function defaultHookReturn() {
  return {
    entries: [] as WorkspaceEntry[],
    viewingFile: null,
    currentPath: "",
    breadcrumbs: [{ label: "~", path: "" }],
    loading: false,
    saving: false,
    error: null,
    navigateToDir: vi.fn(),
    openFile: vi.fn(),
    closeFile: vi.fn(),
    refresh: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    fileExists: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceExplorerPanel", () => {
  it("renders empty state when no agent selected", () => {
    mockUseWorkspaceFiles.mockReturnValue(defaultHookReturn());
    render(<WorkspaceExplorerPanel agentId={null} />);
    expect(screen.getByText("Select an agent to browse workspace files")).toBeInTheDocument();
  });

  it("renders empty directory message when agent selected but no files", () => {
    mockUseWorkspaceFiles.mockReturnValue(defaultHookReturn());
    render(<WorkspaceExplorerPanel agentId="alex" />);
    expect(screen.getByText("Empty directory")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading with no entries", () => {
    mockUseWorkspaceFiles.mockReturnValue({ ...defaultHookReturn(), loading: true });
    render(<WorkspaceExplorerPanel agentId="alex" />);
    expect(screen.getByTestId("workspace-panel")).toBeInTheDocument();
    // Should not show empty state while loading
    expect(screen.queryByText("Empty directory")).not.toBeInTheDocument();
  });

  it("renders error banner when error present", () => {
    mockUseWorkspaceFiles.mockReturnValue({ ...defaultHookReturn(), error: "Failed to load" });
    render(<WorkspaceExplorerPanel agentId="alex" />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders entries when files exist at root", () => {
    const entries: WorkspaceEntry[] = [
      { name: "SOUL.md", path: "SOUL.md", type: "file" },
      { name: "projects", path: "projects", type: "directory" },
    ];
    mockUseWorkspaceFiles.mockReturnValue({ ...defaultHookReturn(), entries });
    render(<WorkspaceExplorerPanel agentId="alex" />);
    expect(screen.getByTestId("workspace-panel")).toBeInTheDocument();
  });
});
