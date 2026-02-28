"use client";

import React, { useCallback, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
  SideSheetDescription,
} from "@/components/ui/SideSheet";
import { SecureInput } from "@/components/ui/SecureInput";
import { cn } from "@/lib/utils";
import type { Skill } from "../lib/types";

export interface SkillDetailSheetProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onSaveApiKey: (key: string, apiKey: string) => Promise<void>;
  onSetupCredential?: (skill: Skill) => void;
  busy: boolean;
}

export const SkillDetailSheet = React.memo(function SkillDetailSheet({
  skill,
  open,
  onOpenChange,
  onToggle,
  onSaveApiKey,
  onSetupCredential,
  busy,
}: SkillDetailSheetProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!skill || !apiKey.trim()) return;
    setSaving(true);
    try {
      await onSaveApiKey(skill.key, apiKey.trim());
      setApiKey("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [skill, apiKey, onSaveApiKey, onOpenChange]);

  const handleToggle = useCallback(async () => {
    if (!skill) return;
    await onToggle(skill.key, !skill.enabled);
  }, [skill, onToggle]);

  // Reset API key input when sheet opens/closes
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) setApiKey("");
      onOpenChange(o);
    },
    [onOpenChange],
  );

  if (!skill) return null;

  const needsApiKey =
    skill.envRequirements.some((e) => e.required && !e.hasValue) && !skill.hasApiKey;

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold">
            {skill.name}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody>
          <div className="flex flex-col gap-5">
            {/* Description */}
            <SideSheetDescription className="text-sm text-muted-foreground">
              {skill.description || "No description available."}
            </SideSheetDescription>

            {/* Enable/Disable */}
            <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/40 px-3 py-2.5">
              <span className="text-sm font-medium">Enabled</span>
              <button
                type="button"
                role="switch"
                aria-checked={skill.enabled}
                aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleToggle();
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                  "min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  skill.enabled ? "bg-primary" : "bg-muted",
                )}
              >
                {busy ? (
                  <Loader2 className="mx-auto h-3 w-3 animate-spin text-foreground" />
                ) : (
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      skill.enabled ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                )}
              </button>
            </div>

            {/* API Key section */}
            {(needsApiKey || skill.hasApiKey || skill.envRequirements.length > 0) && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  API Key
                </h3>

                {skill.hasApiKey && skill.apiKeyMasked && (
                  <p className="text-xs text-muted-foreground">
                    Current: <code className="font-mono">{skill.apiKeyMasked}</code>
                  </p>
                )}

                {needsApiKey && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Required API key not configured</span>
                    </div>
                    {onSetupCredential && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onSetupCredential(skill);
                        }}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 px-4",
                          "text-sm font-medium text-amber-500 transition-colors",
                          "min-h-[44px] md:min-h-0",
                          "hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                        )}
                      >
                        Set up in Credential Vault
                      </button>
                    )}
                  </div>
                )}

                {skill.envRequirements.length > 0 && (
                  <div className="text-[11px] text-muted-foreground/70">
                    <span className="font-medium">Required env vars: </span>
                    {skill.envRequirements.map((e) => e.key).join(", ")}
                  </div>
                )}

                <SecureInput
                  id={`apikey-${skill.key}`}
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="Enter API key…"
                  label="New API Key"
                />

                <button
                  type="button"
                  disabled={!apiKey.trim() || saving}
                  onClick={handleSave}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md bg-primary px-4",
                    "text-sm font-medium text-primary-foreground transition-colors",
                    "min-h-[44px] md:min-h-0",
                    "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save API Key"
                  )}
                </button>
              </div>
            )}

            {/* Missing deps */}
            {skill.missingDeps.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Missing Dependencies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {skill.missingDeps.map((dep) => (
                    <span
                      key={dep}
                      className="rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-mono text-destructive"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Meta info */}
            <div className="flex flex-col gap-1.5 border-t border-border/20 pt-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground capitalize">{skill.source}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Key</span>
                <span className="font-mono text-foreground">{skill.key}</span>
              </div>
              {skill.location && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Location</span>
                  <span className="max-w-[200px] truncate font-mono text-foreground" title={skill.location}>
                    {skill.location}
                  </span>
                </div>
              )}
              {skill.blockReason && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Block reason</span>
                  <span className="text-amber-500">{skill.blockReason}</span>
                </div>
              )}
            </div>
          </div>
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
