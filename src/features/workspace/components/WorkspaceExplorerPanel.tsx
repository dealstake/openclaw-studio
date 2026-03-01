"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Folder } from "lucide-react";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FileEditorModal } from "@/components/FileEditorModal";

import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { usePinnedFiles } from "../hooks/usePinnedFiles";
import type { WorkspaceEntry } from "../types";
import { WorkspaceBreadcrumbHeader } from "./WorkspaceBreadcrumbHeader";
import { FileTreeView } from "./FileTreeView";
import { WorkspaceLoadingSkeleton } from "./WorkspaceLoadingSkeleton";
import { NewFileDialog } from "./NewFileDialog";
import { FileViewer } from "./FileViewer";
import { MemorySearchView } from "./MemorySearchView";

// ── Main Panel ──

type WorkspaceExplorerPanelProps = {
  agentId: string | null | undefined;
  client?: GatewayClient | null;
  isTabActive?: boolean;
  /** Increments on cron/session events to trigger immediate refresh */
  eventTick?: number;
};

export const WorkspaceExplorerPanel = memo(function WorkspaceExplorerPanel({
  agentId,
  client,
  isTabActive,
  eventTick,
}: WorkspaceExplorerPanelProps) {
  const {
    entries,
    viewingFile,
    currentPath,
    breadcrumbs,
    loading,
    saving,
    error,
    navigateToDir,
    openFile,
    closeFile,
    refresh,
    saveFile,
    createFile,
    fileExists,
    fetchDirChildren,
  } = useWorkspaceFiles({ agentId, client, isTabActive, eventTick });

  const [searchMode, setSearchMode] = useState(false);
  const { pinnedEntries, isPinned, togglePin } = usePinnedFiles(agentId);

  const [modalFile, setModalFile] = useState<string | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{
    open: boolean;
    path: string;
    name: string;
  }>({ open: false, path: "", name: "" });

  // FileTreeView handles directory expansion internally.
  // This handler is only called for file nodes.
  const handleFileClick = useCallback(
    (entry: WorkspaceEntry) => {
      if (entry.path.endsWith(".md")) {
        setModalFile(entry.path);
      } else {
        openFile(entry.path);
      }
    },
    [openFile]
  );

  const handleSaveFile = useCallback(
    async (content: string): Promise<boolean> => {
      if (!viewingFile) return false;
      return saveFile(viewingFile.path, content);
    },
    [viewingFile, saveFile]
  );

  const doCreateFile = useCallback(
    async (relativePath: string) => {
      const ok = await createFile(relativePath, "");
      if (ok) {
        setShowNewFile(false);
        openFile(relativePath);
      }
    },
    [createFile, openFile]
  );

  const handleNewFile = useCallback(
    async (name: string) => {
      const relativePath = currentPath ? `${currentPath}/${name}` : name;
      const exists = await fileExists(relativePath);
      if (exists) {
        setOverwriteConfirm({ open: true, path: relativePath, name });
        return;
      }
      await doCreateFile(relativePath);
    },
    [currentPath, fileExists, doCreateFile]
  );

  const handleOverwriteConfirm = useCallback(() => {
    setOverwriteConfirm((prev) => ({ ...prev, open: false }));
    void doCreateFile(overwriteConfirm.path);
  }, [overwriteConfirm.path, doCreateFile]);

  /** Open a file from a search result and exit search mode. */
  const handleSearchOpen = useCallback(
    (path: string) => {
      setSearchMode(false);
      openFile(path);
    },
    [openFile]
  );

  const handleToggleSearch = useCallback(() => {
    setSearchMode((prev) => !prev);
  }, []);

  // Keyboard shortcut: Escape closes search mode or goes back from file viewer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchMode) {
          setSearchMode(false);
        } else if (viewingFile) {
          closeFile();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [viewingFile, closeFile, searchMode]);

  // File viewer mode (full-height, no header chrome)
  if (viewingFile) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden" data-testid="workspace-panel">
        <FileViewer
          key={viewingFile.path}
          file={viewingFile}
          onBack={closeFile}
          onSave={handleSaveFile}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-testid="workspace-panel">
      <WorkspaceBreadcrumbHeader
        breadcrumbs={breadcrumbs}
        loading={loading}
        onNavigate={navigateToDir}
        onNewFile={() => setShowNewFile((p) => !p)}
        onRefresh={refresh}
        onSearch={agentId ? handleToggleSearch : undefined}
        searchActive={searchMode}
      />

      {/* ── Memory search mode — replaces file tree ── */}
      {searchMode && agentId && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <MemorySearchView
            agentId={agentId}
            onOpenFile={handleSearchOpen}
            onClose={() => setSearchMode(false)}
          />
        </div>
      )}

      {/* ── Normal file browser ── */}
      {!searchMode && (
        <>
          {showNewFile && (
            <NewFileDialog
              currentPath={currentPath}
              onSubmit={(name) => { void handleNewFile(name); }}
              onCancel={() => setShowNewFile(false)}
              saving={saving}
            />
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {error && <ErrorBanner message={error} onRetry={refresh} className="mx-3 mt-2" />}

            {loading && entries.length === 0 && <WorkspaceLoadingSkeleton />}

            {!error && entries.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Folder className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">
                  {agentId ? "Empty directory" : "Select an agent to browse workspace files"}
                </span>
              </div>
            )}

            {!error && entries.length > 0 && (
              <FileTreeView
                entries={entries}
                fetchDirChildren={fetchDirChildren}
                onFileClick={handleFileClick}
                isPinned={isPinned}
                onTogglePin={togglePin}
                pinnedEntries={pinnedEntries}
              />
            )}
          </div>
        </>
      )}

      {/* ── Shared dialogs (rendered in both modes) ── */}
      <ConfirmDialog
        open={overwriteConfirm.open}
        onOpenChange={(open) => setOverwriteConfirm((prev) => ({ ...prev, open }))}
        title="File already exists"
        description={`"${overwriteConfirm.name}" already exists. Do you want to overwrite it?`}
        confirmLabel="Overwrite"
        destructive
        onConfirm={handleOverwriteConfirm}
      />
      {agentId && (
        <FileEditorModal
          open={!!modalFile}
          onOpenChange={(nextOpen) => { if (!nextOpen) setModalFile(null); }}
          agentId={agentId}
          filePath={modalFile ?? ""}
          onSaved={refresh}
        />
      )}
    </div>
  );
});
