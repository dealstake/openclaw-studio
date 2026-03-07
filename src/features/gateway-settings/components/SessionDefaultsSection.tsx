"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SectionLabel } from "@/components/SectionLabel";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CompactionConfig, ParsedGatewaySettings, SessionResetConfig } from "../lib/types";
import { updateSessionDefaults } from "../lib/gatewaySettingsService";

interface SessionDefaultsSectionProps {
  config: ParsedGatewaySettings;
  client: GatewayClient;
  onSaved: () => Promise<void>;
}

type ResetMode = "daily" | "idle" | "";

/** Derive initial state from config prop */
function initFromConfig(config: ParsedGatewaySettings) {
  return {
    resetMode: config.session.mode as ResetMode,
    atHour: config.session.atHour?.toString() ?? "",
    idleMinutes: config.session.idleMinutes?.toString() ?? "",
    compactionMode: config.compaction.mode as "default" | "safeguard" | "",
    memoryFlushEnabled: config.compaction.memoryFlush?.enabled ?? false,
  };
}

export const SessionDefaultsSection = memo(function SessionDefaultsSection({
  config,
  client,
  onSaved,
}: SessionDefaultsSectionProps) {
  const [resetMode, setResetMode] = useState<ResetMode>(config.session.mode);
  const [atHour, setAtHour] = useState(config.session.atHour?.toString() ?? "");
  const [idleMinutes, setIdleMinutes] = useState(
    config.session.idleMinutes?.toString() ?? "",
  );
  const [compactionMode, setCompactionMode] = useState<"default" | "safeguard" | "">(
    config.compaction.mode,
  );
  const [memoryFlushEnabled, setMemoryFlushEnabled] = useState(
    config.compaction.memoryFlush?.enabled ?? false,
  );

  const [errors, setErrors] = useState<{ atHour?: string; idleMinutes?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sync local state when config reloads after save
  useEffect(() => {
    const next = initFromConfig(config);
    setResetMode(next.resetMode);
    setAtHour(next.atHour);
    setIdleMinutes(next.idleMinutes);
    setCompactionMode(next.compactionMode);
    setMemoryFlushEnabled(next.memoryFlushEnabled);
    setErrors({});
  }, [config]);

  // ── Dirty checks ────────────────────────────────────────────────────────
  const sessionResetDirty =
    resetMode !== config.session.mode ||
    (resetMode === "daily" && atHour !== (config.session.atHour?.toString() ?? "")) ||
    (resetMode === "idle" &&
      idleMinutes !== (config.session.idleMinutes?.toString() ?? ""));

  const compactionDirty =
    compactionMode !== config.compaction.mode ||
    memoryFlushEnabled !== (config.compaction.memoryFlush?.enabled ?? false);

  const isDirty = sessionResetDirty || compactionDirty;

  // ── Validation ──────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: { atHour?: string; idleMinutes?: string } = {};
    if (resetMode === "daily") {
      const hour = Number(atHour);
      if (atHour === "" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
        errs.atHour = "Must be an integer between 0 and 23";
      }
    }
    if (resetMode === "idle") {
      const mins = Number(idleMinutes);
      if (idleMinutes === "" || !Number.isInteger(mins) || mins <= 0) {
        errs.idleMinutes = "Must be a positive integer";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save logic ──────────────────────────────────────────────────────────
  const handleSaveClick = useCallback(() => {
    if (!validate()) return;
    // Show confirmation dialog only when session reset settings are changing
    if (sessionResetDirty) {
      setConfirmOpen(true);
    } else {
      void doSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionResetDirty, resetMode, atHour, idleMinutes, compactionMode, memoryFlushEnabled]);

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const sessionPatch: Partial<SessionResetConfig> = {};
      const compactionPatch: Partial<CompactionConfig> = {};

      if (sessionResetDirty) {
        sessionPatch.mode = resetMode;
        if (resetMode === "daily" && atHour !== "") {
          sessionPatch.atHour = Number(atHour);
        }
        if (resetMode === "idle" && idleMinutes !== "") {
          sessionPatch.idleMinutes = Number(idleMinutes);
        }
      }

      if (compactionDirty) {
        if (compactionMode !== config.compaction.mode) {
          compactionPatch.mode = compactionMode;
        }
        if (memoryFlushEnabled !== (config.compaction.memoryFlush?.enabled ?? false)) {
          compactionPatch.memoryFlush = { enabled: memoryFlushEnabled };
        }
      }

      await updateSessionDefaults(client, sessionPatch, compactionPatch);
      await onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
      setSaving(false);
    }
  }, [
    client,
    onSaved,
    sessionResetDirty,
    compactionDirty,
    resetMode,
    atHour,
    idleMinutes,
    compactionMode,
    memoryFlushEnabled,
    config.compaction.mode,
    config.compaction.memoryFlush,
  ]);

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false);
    await doSave();
  }, [doSave]);

  // ── Mode change helpers ─────────────────────────────────────────────────
  const handleModeChange = useCallback((mode: ResetMode) => {
    setResetMode(mode);
    setErrors({});
  }, []);

  return (
    <section aria-label="Session Defaults">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Session Defaults
      </SectionLabel>

      <div className="rounded-md border border-border/80 bg-card/70 p-4 space-y-5">
        {/* ── Session Reset ── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Session Reset
          </p>

          {/* Radio group for mode */}
          <div
            role="radiogroup"
            aria-label="Session reset mode"
            className="flex gap-3 mb-3"
          >
            {(
              [
                { value: "daily", label: "Daily" },
                { value: "idle", label: "Idle" },
                { value: "", label: "Disabled" },
              ] as { value: ResetMode; label: string }[]
            ).map(({ value, label }) => (
              <label
                key={label}
                className="flex min-h-[44px] md:min-h-0 cursor-pointer items-center gap-1.5 text-sm"
              >
                <input
                  type="radio"
                  name="resetMode"
                  value={value}
                  checked={resetMode === value}
                  onChange={() => handleModeChange(value)}
                  disabled={saving}
                  className="accent-primary h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-xs text-foreground">{label}</span>
              </label>
            ))}
          </div>

          {/* Daily: atHour input */}
          {resetMode === "daily" && (
            <div className="mb-1">
              <label
                htmlFor="session-at-hour"
                className="text-xs text-muted-foreground"
              >
                Reset at hour (UTC, 0–23)
              </label>
              <input
                id="session-at-hour"
                type="number"
                min={0}
                max={23}
                value={atHour}
                onChange={(e) => {
                  setAtHour(e.target.value);
                  setErrors((prev) => ({ ...prev, atHour: undefined }));
                }}
                disabled={saving}
                aria-label="Reset hour (0–23)"
                aria-describedby={errors.atHour ? "atHour-error" : undefined}
                className="mt-1 h-8 w-24 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
              />
              {errors.atHour && (
                <p id="atHour-error" className="mt-1 text-xs text-destructive">
                  {errors.atHour}
                </p>
              )}
            </div>
          )}

          {/* Idle: idleMinutes input */}
          {resetMode === "idle" && (
            <div className="mb-1">
              <label
                htmlFor="session-idle-minutes"
                className="text-xs text-muted-foreground"
              >
                Idle timeout (minutes)
              </label>
              <input
                id="session-idle-minutes"
                type="number"
                min={1}
                value={idleMinutes}
                onChange={(e) => {
                  setIdleMinutes(e.target.value);
                  setErrors((prev) => ({ ...prev, idleMinutes: undefined }));
                }}
                disabled={saving}
                aria-label="Idle timeout in minutes"
                aria-describedby={errors.idleMinutes ? "idleMinutes-error" : undefined}
                className="mt-1 h-8 w-24 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:border-primary/60 focus:outline-none disabled:opacity-50"
              />
              {errors.idleMinutes && (
                <p id="idleMinutes-error" className="mt-1 text-xs text-destructive">
                  {errors.idleMinutes}
                </p>
              )}
            </div>
          )}

          {resetMode === "" && (
            <p className="text-xs italic text-muted-foreground">
              Sessions are never automatically reset.
            </p>
          )}
        </div>

        {/* ── Compaction ── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Compaction
          </p>

          {/* Compaction mode select */}
          <div className="mb-3">
            <label
              htmlFor="compaction-mode"
              className="text-xs text-muted-foreground"
            >
              Mode
            </label>
            <select
              id="compaction-mode"
              value={compactionMode}
              onChange={(e) =>
                setCompactionMode(e.target.value as "default" | "safeguard" | "")
              }
              disabled={saving}
              aria-label="Compaction mode"
              className="mt-1 block h-8 w-full max-w-[180px] rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:opacity-50"
            >
              <option value="">Not set</option>
              <option value="default">Default</option>
              <option value="safeguard">Safeguard</option>
            </select>
          </div>

          {/* Memory flush toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground">Memory Flush</p>
              <p className="text-xs text-muted-foreground">
                Clear memory context on compaction
              </p>
            </div>
            <ToggleSwitch
              checked={memoryFlushEnabled}
              onChange={() => setMemoryFlushEnabled((v) => !v)}
              disabled={saving}
              label={memoryFlushEnabled ? "Disable memory flush" : "Enable memory flush"}
            />
          </div>
        </div>

        {/* ── Save button ── */}
        {isDirty && (
          <div className="flex items-center justify-end border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              aria-label="Save session defaults"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Confirmation dialog for session reset changes */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
        title="Save Session Reset Changes?"
        description="Changing the session reset policy may affect currently active sessions. Agents may have their sessions reset at the next scheduled interval. Do you want to continue?"
        confirmLabel="Save Changes"
        onConfirm={() => void handleConfirm()}
      />
    </section>
  );
});
