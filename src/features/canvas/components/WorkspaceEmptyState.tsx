"use client";

import { Button } from "@/components/ui/button";

type WorkspaceEmptyStateProps = {
  needsWorkspace: boolean;
  onOpenWorkspaceSettings: () => void;
  onNewAgent: () => void;
};

export const WorkspaceEmptyState = ({
  needsWorkspace,
  onOpenWorkspaceSettings,
  onNewAgent,
}: WorkspaceEmptyStateProps) => {
  const title = needsWorkspace ? "Set a default workspace" : "Create your first agent";
  const body = needsWorkspace
    ? "Choose a folder where Studio agents will read/write files. It must already exist and be a directory."
    : "You don’t have any agents yet. Create one to start chatting and running tasks.";
  const ctaLabel = needsWorkspace ? "Set Workspace" : "New Agent";
  const onCta = needsWorkspace ? onOpenWorkspaceSettings : onNewAgent;

  return (
    <div className="glass-panel px-6 py-8" data-testid="workspace-empty-state">
      <div className="flex flex-col items-start gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>

        <Button type="button" onClick={onCta}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
};
