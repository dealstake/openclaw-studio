"use client";

import { memo, useState, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { WorkspaceExplorerPanel } from "./WorkspaceExplorerPanel";
import { ArtifactsPanel } from "@/features/artifacts/components/ArtifactsPanel";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";

type SubTab = "workspace" | "artifacts";

const SUB_TAB_OPTIONS: FilterGroupOption<SubTab>[] = [
  { value: "workspace", label: "Workspace" },
  { value: "artifacts", label: "Artifacts" },
];

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
      <PanelHeader
        icon={<FolderOpen className="h-4 w-4" />}
        title="Files"
        filters={
          <FilterGroup
            options={SUB_TAB_OPTIONS}
            value={[subTab]}
            onChange={(v) => { if (v.length > 0) handleTabChange(v[v.length - 1]!); }}
            allowEmpty={false}
          />
        }
      />

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
