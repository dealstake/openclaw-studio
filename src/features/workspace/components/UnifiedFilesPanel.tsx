"use client";

import { memo, useState, useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { WorkspaceExplorerPanel } from "./WorkspaceExplorerPanel";
import { ArtifactsPanel } from "@/features/artifacts/components/ArtifactsPanel";

type SubTab = "workspace" | "artifacts";

interface UnifiedFilesPanelProps {
  agentId: string | null | undefined;
  client?: GatewayClient | null;
  isTabActive?: boolean;
  eventTick?: number;
}

export const UnifiedFilesPanel = memo(function UnifiedFilesPanel({
  agentId,
  client,
  isTabActive,
  eventTick,
}: UnifiedFilesPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("workspace");

  const handleTabChange = useCallback((tab: SubTab) => {
    setSubTab(tab);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="File views"
        className="flex shrink-0 items-center gap-1 border-b border-border/50 p-2"
      >
        <button
          type="button"
          role="tab"
          id="workspace-tab"
          aria-controls="files-tabpanel"
          aria-selected={subTab === "workspace"}
          onClick={() => handleTabChange("workspace")}
          className={`rounded-md px-3 py-3 text-xs font-medium transition-colors ${
            subTab === "workspace"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Workspace
        </button>
        <button
          type="button"
          role="tab"
          id="artifacts-tab"
          aria-controls="files-tabpanel"
          aria-selected={subTab === "artifacts"}
          onClick={() => handleTabChange("artifacts")}
          className={`rounded-md px-3 py-3 text-xs font-medium transition-colors ${
            subTab === "artifacts"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Artifacts
        </button>
      </div>

      {/* Panel content */}
      <div
        id="files-tabpanel"
        role="tabpanel"
        aria-labelledby={subTab === "workspace" ? "workspace-tab" : "artifacts-tab"}
        className="min-h-0 flex-1 overflow-hidden"
      >
        {subTab === "workspace" ? (
          <WorkspaceExplorerPanel
            agentId={agentId}
            client={client}
            isTabActive={isTabActive}
            eventTick={eventTick}
          />
        ) : (
          <ArtifactsPanel
            isSelected={isTabActive ?? false}
          />
        )}
      </div>
    </div>
  );
});
