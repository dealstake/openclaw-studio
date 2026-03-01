"use client";

import React, { memo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetBody,
  SideSheetTitle,
  SideSheetDescription,
  SideSheetClose,
} from "@/components/ui/SideSheet";
import { SecureInput } from "@/components/ui/SecureInput";

interface AddKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, provider: string, token: string) => Promise<void>;
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic", prefix: "sk-ant-" },
  { value: "google", label: "Google", prefix: "AIzaSy" },
  { value: "openai", label: "OpenAI", prefix: "sk-" },
  { value: "mistral", label: "Mistral", prefix: "" },
];

export const AddKeyDialog = memo(function AddKeyDialog({
  open,
  onOpenChange,
  onSave,
}: AddKeyDialogProps) {
  const [provider, setProvider] = useState("anthropic");
  const [profileId, setProfileId] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProvider("anthropic");
    setProfileId("");
    setToken("");
    setError(null);
    setSaving(false);
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const handleSave = useCallback(async () => {
    if (!profileId.trim()) {
      setError("Profile ID is required.");
      return;
    }
    if (!token.trim()) {
      setError("API token is required.");
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(profileId.trim())) {
      setError("Profile ID must be alphanumeric (colons, hyphens, underscores allowed).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(profileId.trim(), provider, token.trim());
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
    } finally {
      setSaving(false);
    }
  }, [profileId, provider, token, onSave, reset]);

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold">
            Add API Key
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody>
          <SideSheetDescription className="sr-only">
            Add a new API key for your agent&apos;s brain provider.
          </SideSheetDescription>

          <div className="space-y-4">
            {/* Provider */}
            <div className="space-y-1.5">
              <label
                htmlFor="add-key-provider"
                className="block text-xs font-medium text-muted-foreground"
              >
                Provider <span className="text-destructive">*</span>
              </label>
              <select
                id="add-key-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                required
                className="h-11 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile ID */}
            <div className="space-y-1.5">
              <label
                htmlFor="add-key-id"
                className="block text-xs font-medium text-muted-foreground"
              >
                Profile ID <span className="text-destructive">*</span>
              </label>
              <input
                id="add-key-id"
                type="text"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder={`${provider}:mykey`}
                autoComplete="off"
                spellCheck={false}
                required
                className="h-11 w-full rounded-md border border-border/50 bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier like &quot;anthropic:maxplan&quot; or &quot;openai:main&quot;
              </p>
            </div>

            {/* Token */}
            <SecureInput
              id="add-key-token"
              label="API Token"
              required
              value={token}
              onChange={setToken}
              placeholder={
                PROVIDERS.find((p) => p.value === provider)?.prefix
                  ? `${PROVIDERS.find((p) => p.value === provider)?.prefix}...`
                  : "Paste your API key..."
              }
            />

            {/* Error */}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
                className="h-11 rounded-md px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !token.trim() || !profileId.trim()}
                className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Saving…" : "Save Key"}
              </button>
            </div>
          </div>
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
