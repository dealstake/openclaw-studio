import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/lib/projects/client";
import { useToast } from "@/components/ui/toast";

type WorkspaceSettingsPanelProps = {
  onClose: () => void;
  onSaved: () => void;
};

const validateWorkspacePathFormat = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("/")) {
    return null;
  }
  return "Workspace path must be an absolute path (e.g. /home/ubuntu/...) or start with ~/.";
};

export const WorkspaceSettingsPanel = ({
  onClose,
  onSaved,
}: WorkspaceSettingsPanelProps) => {
  const { toast } = useToast();
  const [workspacePath, setWorkspacePath] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatError = useMemo(
    () => validateWorkspacePathFormat(workspacePath),
    [workspacePath]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchWorkspaceSettings()
      .then((result) => {
        if (!mounted) return;
        setWorkspacePath(result.workspacePath ?? "");
        setWarnings(result.warnings ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load workspace settings.";
        setError(message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = workspacePath.trim();
    if (!trimmed) {
      setError("Workspace path is required.");
      return;
    }

    const formatIssue = validateWorkspacePathFormat(trimmed);
    if (formatIssue) {
      setError(formatIssue);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updateWorkspaceSettings({
        workspacePath: trimmed,
      });
      setWarnings(result.warnings ?? []);
      if (result.warnings.length > 0) {
        toast({
          variant: "warning",
          title: "Saved with warnings",
          message: result.warnings.join(" "),
        });
      } else {
        toast({ variant: "success", title: "Saved", message: "Workspace settings updated." });
      }
      onSaved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save workspace settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [onSaved, toast, workspacePath]);

  return (
    <div className="glass-panel px-6 py-6" data-testid="workspace-settings-panel">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Default Workspace</h2>
            <p className="text-xs text-muted-foreground">
              Change the folder where Studio agents should operate.
            </p>
          </div>
          <button
            className="rounded-lg border border-input px-3 py-1 text-xs font-semibold text-foreground transition hover:border-ring"
            type="button"
            onClick={onClose}
            data-testid="workspace-settings-close"
          >
            Close
          </button>
        </div>

        <div className="grid gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Default workspace path
            <input
              className="h-11 rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-ring"
              value={workspacePath}
              onChange={(event) => setWorkspacePath(event.target.value)}
              placeholder="~/.openclaw/workspace"
              disabled={loading || saving}
              data-testid="workspace-settings-path"
              aria-invalid={Boolean(formatError)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Must be an existing directory. Use an absolute path (e.g. <span className="font-mono">/home/ubuntu/…</span>)
            or <span className="font-mono">~/…</span>. Permissions are validated on save.
          </p>
          {formatError ? (
            <div className="text-xs text-destructive">{formatError}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            data-testid="workspace-settings-save"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button
            className="rounded-lg border border-input px-5 py-2 text-sm font-semibold text-foreground"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading workspace settings…</div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
        {warnings.length > 0 ? (
          <div className="rounded-lg border border-border bg-accent px-4 py-2 text-sm text-accent-foreground">
            {warnings.join(" ")}
          </div>
        ) : null}
      </div>
    </div>
  );
};
