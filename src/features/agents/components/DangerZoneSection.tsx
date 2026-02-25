"use client";

import { memo, useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";

type DangerZoneSectionProps = {
  agentId: string;
  canDelete: boolean;
  onDelete: () => void;
};

export const DangerZoneSection = memo(function DangerZoneSection({
  agentId,
  canDelete,
  onDelete,
}: DangerZoneSectionProps) {
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = useCallback(() => {
    if (showDeleteConfirm && deleteConfirmText === agentId) {
      onDelete();
    } else {
      setShowDeleteConfirm(true);
      setDeleteConfirmText("");
    }
  }, [showDeleteConfirm, deleteConfirmText, agentId, onDelete]);

  if (!canDelete) {
    return (
      <section className="rounded-md border border-border/80 bg-card/70 p-4">
        <SectionLabel>System agent</SectionLabel>
        <div className="mt-3 text-[11px] text-muted-foreground">
          The main agent is reserved and cannot be deleted.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <SectionLabel className="text-destructive">Danger zone</SectionLabel>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Permanently removes this agent from the gateway config and deletes all its cron jobs. This
        action cannot be undone.
      </div>
      {showDeleteConfirm ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] text-muted-foreground">
            Type{" "}
            <span className="font-mono font-semibold text-foreground">{agentId}</span>{" "}
            to confirm:
            <input
              className="mt-1 block h-8 w-full rounded-md border border-destructive/50 bg-card/75 px-3 text-xs font-mono text-foreground outline-none focus:border-destructive"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={agentId}
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-md border border-border bg-transparent px-3 py-2 ${sectionLabelClass} text-foreground transition hover:bg-muted`}
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </button>
            <button
              className={`flex-1 rounded-md border border-destructive/50 bg-transparent px-3 py-2 ${sectionLabelClass} text-destructive shadow-sm transition hover:border-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50`}
              type="button"
              onClick={handleDeleteClick}
              disabled={deleteConfirmText !== agentId}
            >
              Delete agent
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`mt-3 w-full rounded-md border border-destructive/50 bg-transparent px-3 py-2 ${sectionLabelClass} text-destructive shadow-sm transition hover:border-destructive hover:bg-destructive/10`}
          type="button"
          onClick={handleDeleteClick}
        >
          Delete agent
        </button>
      )}
    </section>
  );
});
