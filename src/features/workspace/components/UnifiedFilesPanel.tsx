"use client";

import { memo, useState, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { WorkspaceExplorerPanel } from "./WorkspaceExplorerPanel";
import { ArtifactsPanel } from "@/features/artifacts/components/ArtifactsPanel";
import { SectionLabel } from "@/components/SectionLabel";

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
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <SectionLabel as="span">Files</SectionLabel>
        </div>
      </div>

      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="File views"
        className="flex shrink-0 items-center gap-1 border-b border-border/50 px-3 pb-2"
      >
        <button
          type="button"
          role="tab"
          id="workspace-tab"
          aria-controls="workspace-tabpanel"
          aria-selected={subTab === "workspace"}
          onClick={() => handleTabChange("workspace")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
          aria-controls="artifacts-tabpanel"
          aria-selected={subTab === "artifacts"}
          onClick={() => handleTabChange("artifacts")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "artifacts"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Artifacts
        </button>
      </div>

      {/* Panel content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          id="workspace-tabpanel"
          role="tabpanel"
          aria-labelledby="workspace-tab"
          className={subTab === "workspace" ? "h-full" : "hidden"}
        >
          <WorkspaceExplorerPanel
            agentId={agentId}
            client={client}
            isTabActive={isTabActive && subTab === "workspace"}
            eventTick={eventTick}
          />
        </div>
        <div
          id="artifacts-tabpanel"
          role="tabpanel"
          aria-labelledby="artifacts-tab"
          className={subTab === "artifacts" ? "h-full" : "hidden"}
        >
          <ArtifactsPanel
            isSelected={(isTabActive ?? false) && subTab === "artifacts"}
          />
        </div>
      </div>
    </div>
  );
});
