"use client";

import React, { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Shield, ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { BaseCard } from "@/components/ui/BaseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PanelIconButton } from "@/components/PanelIconButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuthProfiles } from "@/features/models/hooks/useAuthProfiles";
import { useManagementPanel } from "@/components/management/ManagementPanelContext";
import type { AuthProfileInfo } from "@/features/models/lib/types";
import { AddKeyDialog } from "./AddKeyDialog";

interface BrainKeysSectionProps {
  agentId: string | null;
}

/** Format a timestamp (ms) as relative time */
function formatRelativeTime(ts: number | undefined): string {
  if (!ts || ts === 0) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  anthropic: "Anthropic",
  google: "Google",
  openai: "OpenAI",
  mistral: "Mistral",
};

const BrainKeyCard = memo(function BrainKeyCard({
  profile,
  onRemove,
  removing,
}: {
  profile: AuthProfileInfo;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isDisabled = !!profile.disabledUntil && profile.disabledUntil > 0;
  const isCooling = !!profile.cooldownUntil && profile.cooldownUntil > 0 && !isDisabled;

  return (
    <>
      <BaseCard variant="compact" className="animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="flex items-start gap-3 p-3">
          {/* Status icon */}
          <div className="mt-0.5 flex-shrink-0">
            {isDisabled ? (
              <ShieldAlert className="h-4 w-4 text-destructive" />
            ) : (
              <Shield className="h-4 w-4 text-emerald-500" />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {profile.id}
              </span>
              {profile.isLastGood && (
                <span className="flex-shrink-0 rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Active
                </span>
              )}
              {isDisabled && (
                <span className="flex-shrink-0 rounded-full bg-destructive/25 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  Disabled
                </span>
              )}
              {isCooling && !isDisabled && (
                <span className="flex-shrink-0 rounded-full bg-yellow-500/25 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                  Cooldown
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{profile.maskedToken}</span>
              <span>{PROVIDER_DISPLAY[profile.provider] ?? profile.provider}</span>
            </div>
            {profile.usage && (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Last used: {formatRelativeTime(profile.usage.lastUsed)}</span>
                {(profile.usage.errorCount ?? 0) > 0 && (
                  <span className="text-destructive">
                    {profile.usage.errorCount} errors
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <PanelIconButton
            aria-label={`Remove key ${profile.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(true);
            }}
            disabled={removing}
            className="flex-shrink-0"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </PanelIconButton>
        </div>
      </BaseCard>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Remove API Key"
        description={`Remove "${profile.id}"? The agent will lose access to this key. A gateway restart may be needed for it to take effect.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => onRemove(profile.id)}
      />
    </>
  );
});

export const BrainKeysSection = memo(function BrainKeysSection({
  agentId,
}: BrainKeysSectionProps) {
  const { onNavigateToCredentials } = useManagementPanel();
  const { profiles, loading, error, refresh, addKey, removeKey } =
    useAuthProfiles(agentId);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemove = useCallback(
    async (id: string) => {
      setRemovingId(id);
      try {
        await removeKey(id);
      } finally {
        setRemovingId(null);
      }
    },
    [removeKey],
  );

  const handleAdd = useCallback(
    async (id: string, provider: string, token: string) => {
      await addKey(id, provider, token);
      setShowAdd(false);
    },
    [addKey],
  );

  // Group profiles by provider
  const byProvider = profiles.reduce<Record<string, AuthProfileInfo[]>>(
    (acc, p) => {
      const key = p.provider;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>
          <span aria-hidden="true">🔑 </span>API Keys
        </SectionLabel>
        <PanelIconButton
          aria-label="Add API key"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </PanelIconButton>
      </div>

      <p className="text-xs text-muted-foreground">
        Authentication keys for your agent&apos;s primary brain provider.
        Multiple keys enable automatic failover.
      </p>
      <button
        type="button"
        onClick={onNavigateToCredentials}
        className="inline-flex items-center min-h-[44px] px-1 -ml-1 text-xs text-brand-gold/80 hover:text-brand-gold underline-offset-2 hover:underline transition-colors"
      >
        Manage service credentials →
      </button>

      {error && <ErrorBanner message={error} />}

      {!loading && profiles.length === 0 && (
        <EmptyState
          icon={KeyRound}
          title="No API keys added yet"
          description="Keys are optional — your gateway may already have provider credentials configured."
          action={{ label: "Open Credentials", onClick: onNavigateToCredentials }}
        />
      )}

      {Object.entries(byProvider).map(([provider, providerProfiles]) => (
        <div key={provider} className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {PROVIDER_DISPLAY[provider] ?? provider}
          </h4>
          {providerProfiles.map((profile) => (
            <BrainKeyCard
              key={profile.id}
              profile={profile}
              onRemove={handleRemove}
              removing={removingId === profile.id}
            />
          ))}
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        New keys take effect on the next session. Restart the gateway for
        immediate effect.
      </p>

      <AddKeyDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onSave={handleAdd}
      />
    </div>
  );
});
