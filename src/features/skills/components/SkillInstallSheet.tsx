"use client";

import React, { useCallback, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
  SideSheetDescription,
} from "@/components/ui/SideSheet";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { cn } from "@/lib/utils";
import { installSkill } from "../lib/skillService";

export interface SkillInstallSheetProps {
  client: GatewayClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
}

export const SkillInstallSheet = React.memo(function SkillInstallSheet({
  client,
  open,
  onOpenChange,
  onInstalled,
}: SkillInstallSheetProps) {
  const [slug, setSlug] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInstall = useCallback(async () => {
    const trimmed = slug.trim();
    if (!trimmed) return;
    setInstalling(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await installSkill(client, trimmed);
      setSuccess(result.message ?? `Installed "${trimmed}" successfully.`);
      setSlug("");
      onInstalled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setInstalling(false);
    }
  }, [client, slug, onInstalled]);

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        setSlug("");
        setError(null);
        setSuccess(null);
      }
      onOpenChange(o);
    },
    [onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && slug.trim() && !installing) {
        void handleInstall();
      }
    },
    [slug, installing, handleInstall],
  );

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-base font-semibold">
            Install from ClawHub
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody>
          <div className="flex flex-col gap-5">
            <SideSheetDescription className="text-sm text-muted-foreground">
              Enter a skill slug to install from{" "}
              <a
                href="https://clawhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary-text hover:underline"
              >
                clawhub.com
                <ExternalLink className="h-3 w-3" />
              </a>
              . Browse the registry to find skill names.
            </SideSheetDescription>

            {/* Slug input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="skill-slug"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Skill Slug
              </label>
              <input
                id="skill-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. weather, github, summarize"

                disabled={installing}
                className={cn(
                  "h-9 w-full rounded-md border border-border bg-background px-3",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
            </div>

            {/* Install button */}
            <button
              type="button"
              disabled={!slug.trim() || installing}
              onClick={() => void handleInstall()}
              className={cn(
                "flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4",
                "text-sm font-medium text-primary-foreground transition-colors",
                "min-h-[44px] md:min-h-0",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {installing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Install Skill
                </>
              )}
            </button>

            {/* Success message */}
            {success && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                {success}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Help text */}
            <div className="border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How it works
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                <li>
                  1. Browse{" "}
                  <a
                    href="https://clawhub.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-text hover:underline"
                  >
                    clawhub.com
                  </a>{" "}
                  to find a skill
                </li>
                <li>2. Copy the skill slug (e.g. &quot;weather&quot;)</li>
                <li>3. Paste it above and click Install</li>
                <li>4. The skill will be available after the next agent session</li>
              </ul>
            </div>
          </div>
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
