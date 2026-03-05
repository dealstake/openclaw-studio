"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SectionLabel } from "@/components/SectionLabel";
import { ModelPicker } from "@/features/models/components/ModelPicker";
import type { ProviderSummary } from "@/features/models/lib/types";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { ParsedGatewaySettings } from "../lib/types";
import {
  addCatalogEntry,
  removeCatalogEntry,
  updateCatalogAlias,
  updateModelFallbacks,
  updateModelPrimary,
} from "../lib/gatewaySettingsService";

interface ModelDefaultsSectionProps {
  config: ParsedGatewaySettings;
  client: GatewayClient;
  providers: ProviderSummary[];
  onSaved: () => Promise<void>;
}

export const ModelDefaultsSection = memo(function ModelDefaultsSection({
  config,
  client,
  providers,
  onSaved,
}: ModelDefaultsSectionProps) {
  const { modelDefaults } = config;

  // ── Primary model ──────────────────────────────────────────────────────
  const [pendingPrimary, setPendingPrimary] = useState<string | null>(null);
  const [confirmPrimary, setConfirmPrimary] = useState(false);
  const [savingPrimary, setSavingPrimary] = useState(false);

  const handlePrimaryChange = useCallback((modelKey: string) => {
    setPendingPrimary(modelKey);
    setConfirmPrimary(true);
  }, []);

  const handleConfirmPrimary = useCallback(async () => {
    if (!pendingPrimary) return;
    setSavingPrimary(true);
    try {
      await updateModelPrimary(client, pendingPrimary);
      await onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
      setSavingPrimary(false);
      setPendingPrimary(null);
      setConfirmPrimary(false);
    }
  }, [client, onSaved, pendingPrimary]);

  // ── Fallback chain ─────────────────────────────────────────────────────
  const [fallbacks, setFallbacks] = useState<string[]>(modelDefaults.fallbacks);
  const [fallbackInput, setFallbackInput] = useState("");
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [savingFallbacks, setSavingFallbacks] = useState(false);

  // Sync from props when config reloads after save
  useEffect(() => {
    setFallbacks(modelDefaults.fallbacks);
  }, [modelDefaults.fallbacks]);

  const handleAddFallback = useCallback(() => {
    const key = fallbackInput.trim();
    if (!key) return;
    if (!key.includes("/")) {
      setFallbackError(
        "Model key must be in provider/model format (e.g. anthropic/claude-opus-4-6)",
      );
      return;
    }
    setFallbackError(null);
    setFallbacks((prev) => [...prev, key]);
    setFallbackInput("");
  }, [fallbackInput]);

  const handleRemoveFallback = useCallback((idx: number) => {
    setFallbacks((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleMoveFallback = useCallback((idx: number, dir: -1 | 1) => {
    setFallbacks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  }, []);

  const handleSaveFallbacks = useCallback(async () => {
    setSavingFallbacks(true);
    try {
      await updateModelFallbacks(client, fallbacks);
      await onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
      setSavingFallbacks(false);
    }
  }, [client, fallbacks, onSaved]);

  const fallbacksDirty =
    JSON.stringify(fallbacks) !== JSON.stringify(modelDefaults.fallbacks);

  // ── Model catalog ──────────────────────────────────────────────────────
  const [newCatalogKey, setNewCatalogKey] = useState("");
  const [newCatalogAlias, setNewCatalogAlias] = useState("");
  const [catalogKeyError, setCatalogKeyError] = useState<string | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [editAliasValue, setEditAliasValue] = useState("");

  const handleAddCatalogEntry = useCallback(async () => {
    const key = newCatalogKey.trim();
    if (!key) return;
    if (!key.includes("/")) {
      setCatalogKeyError(
        "Model key must be in provider/model format (e.g. anthropic/claude-opus-4-6)",
      );
      return;
    }
    setCatalogKeyError(null);
    setSavingCatalog(true);
    try {
      await addCatalogEntry(client, key, newCatalogAlias.trim() || undefined);
      setNewCatalogKey("");
      setNewCatalogAlias("");
      await onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
      setSavingCatalog(false);
    }
  }, [client, newCatalogAlias, newCatalogKey, onSaved]);

  const handleRemoveCatalogEntry = useCallback(
    async (key: string) => {
      setSavingCatalog(true);
      try {
        await removeCatalogEntry(client, key);
        await onSaved();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
        setSavingCatalog(false);
      }
    },
    [client, onSaved],
  );

  const handleStartEditAlias = useCallback(
    (key: string, currentAlias?: string) => {
      setEditingAlias(key);
      setEditAliasValue(currentAlias ?? "");
    },
    [],
  );

  const handleSaveAlias = useCallback(
    async (key: string) => {
      setSavingCatalog(true);
      try {
        await updateCatalogAlias(client, key, editAliasValue.trim());
        setEditingAlias(null);
        await onSaved();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Settings update failed"); } finally {
        setSavingCatalog(false);
      }
    },
    [client, editAliasValue, onSaved],
  );

  const catalogEntries = Object.entries(modelDefaults.catalog);

  return (
    <section aria-label="Model Defaults">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Model Defaults
      </SectionLabel>

      <div className="space-y-5 rounded-md border border-border/80 bg-card/70 p-4">
        {/* ── Primary model ── */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
            Primary Model
          </p>

          {savingPrimary ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Saving…</span>
            </div>
          ) : (
            <ModelPicker
              value={modelDefaults.primary}
              onChange={handlePrimaryChange}
              providers={providers}
              disabled={savingPrimary}
            />
          )}

          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            Default model used by all agents when no override is set.
          </p>
        </div>

        {/* ── Fallback chain ── */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
            Fallback Chain
          </p>

          {fallbacks.length > 0 ? (
            <ol className="mb-2 space-y-1.5">
              {fallbacks.map((f, i) => (
                <li
                  key={`${f}-${i}`}
                  className="flex items-center gap-1.5 rounded-md border border-border/80 bg-card/75 px-2.5 py-1.5"
                >
                  <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="flex-1 truncate font-mono text-xs text-foreground">
                    {f}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Move ${f} up`}
                      onClick={() => handleMoveFallback(i, -1)}
                      disabled={i === 0}
                      className="inline-flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${f} down`}
                      onClick={() => handleMoveFallback(i, 1)}
                      disabled={i === fallbacks.length - 1}
                      className="inline-flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${f} from fallbacks`}
                      onClick={() => handleRemoveFallback(i)}
                      className="inline-flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mb-2 text-[11px] italic text-muted-foreground">
              No fallbacks configured
            </p>
          )}

          {/* Add fallback input */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={fallbackInput}
              onChange={(e) => {
                setFallbackInput(e.target.value);
                setFallbackError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFallback();
              }}
              placeholder="provider/model-key"
              aria-label="Add fallback model"
              className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddFallback}
              aria-label="Add fallback model to list"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {fallbackError && (
            <p className="mt-1 text-[11px] text-destructive">{fallbackError}</p>
          )}

          {/* Save fallbacks — only visible when list changed */}
          {fallbacksDirty && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveFallbacks()}
                disabled={savingFallbacks}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {savingFallbacks ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Fallbacks
              </button>
            </div>
          )}
        </div>

        {/* ── Model catalog ── */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
            Model Catalog ({catalogEntries.length}{" "}
            {catalogEntries.length === 1 ? "entry" : "entries"})
          </p>

          {catalogEntries.length > 0 ? (
            <ul className="mb-2 space-y-1.5">
              {catalogEntries.map(([key, entry]) => (
                <li
                  key={key}
                  className="rounded-md border border-border/80 bg-card/75 px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                      {key}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {editingAlias !== key && (
                        <button
                          type="button"
                          aria-label={`Edit alias for ${key}`}
                          onClick={() => handleStartEditAlias(key, entry.alias)}
                          className="inline-flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${key} from catalog`}
                        onClick={() => void handleRemoveCatalogEntry(key)}
                        disabled={savingCatalog}
                        className="inline-flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Alias edit row or display */}
                  {editingAlias === key ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editAliasValue}
                        onChange={(e) => setEditAliasValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveAlias(key);
                          if (e.key === "Escape") setEditingAlias(null);
                        }}
                        placeholder="alias (optional)"
                        aria-label={`Alias for ${key}`}
                        autoFocus
                        className="h-7 min-w-0 flex-1 rounded border border-border/60 bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Save alias"
                        onClick={() => void handleSaveAlias(key)}
                        disabled={savingCatalog}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      >
                        {savingCatalog ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel editing alias"
                        onClick={() => setEditingAlias(null)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    entry.alias && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        alias: {entry.alias}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[11px] italic text-muted-foreground">
              No catalog entries
            </p>
          )}

          {/* Add catalog entry form */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCatalogKey}
                onChange={(e) => {
                  setNewCatalogKey(e.target.value);
                  setCatalogKeyError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddCatalogEntry();
                }}
                placeholder="provider/model-key"
                aria-label="New catalog entry model key"
                className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
              />
              <input
                type="text"
                value={newCatalogAlias}
                onChange={(e) => setNewCatalogAlias(e.target.value)}
                placeholder="alias (opt.)"
                aria-label="New catalog entry alias"
                className="h-8 w-24 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleAddCatalogEntry()}
                disabled={savingCatalog || !newCatalogKey.trim()}
                aria-label="Add model to catalog"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-card px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                {savingCatalog ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </button>
            </div>
            {catalogKeyError && (
              <p className="text-[11px] text-destructive">{catalogKeyError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Confirm primary model change dialog */}
      <ConfirmDialog
        open={confirmPrimary}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmPrimary(false);
            setPendingPrimary(null);
          }
        }}
        title="Change Primary Model?"
        description={`This changes the default model for all agents to "${pendingPrimary ?? ""}". Agents without a model override will use this model immediately.`}
        confirmLabel="Change Model"
        onConfirm={() => void handleConfirmPrimary()}
      />
    </section>
  );
});
