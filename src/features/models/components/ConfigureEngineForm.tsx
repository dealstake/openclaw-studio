"use client";

import { memo, useCallback, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { SecureInput } from "@/components/ui/SecureInput";
import type { EngineTemplate, SpecialistEngine } from "@/features/models/lib/types";

interface ConfigureEngineFormProps {
  /** Template for this engine type */
  template: EngineTemplate;
  /** Existing engine config (null for new engines) */
  existing?: SpecialistEngine | null;
  /** Called on save with the form values */
  onSave: (data: {
    apiKey: string;
    model: string;
    fallbackModel: string | null;
  }) => Promise<void>;
  /** Called on cancel */
  onCancel: () => void;
}

export const ConfigureEngineForm = memo(function ConfigureEngineForm({
  template,
  existing,
  onSave,
  onCancel,
}: ConfigureEngineFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(
    existing?.model || template.defaultModel,
  );
  const [fallbackModel, setFallbackModel] = useState(
    existing?.fallbackModel || template.defaultFallback,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    // Validation: API key required for new engines, optional for existing
    const effectiveKey = apiKey.trim();
    if (!existing && !effectiveKey) {
      setError("API key is required.");
      return;
    }
    if (!model) {
      setError("Please select a model.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        apiKey: effectiveKey || "",
        model,
        fallbackModel: fallbackModel || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save engine.");
      setSaving(false);
    }
  }, [apiKey, model, fallbackModel, existing, onSave]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {template.icon}
        </span>
        <h4 className="text-sm font-medium text-foreground">
          {existing ? `Configure ${template.displayName}` : `Add ${template.displayName}`}
        </h4>
      </div>

      <p className="text-xs text-muted-foreground">{template.description}</p>

      {/* API Key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            API Key{!existing && <span className="ml-0.5 text-destructive">*</span>}
          </label>
          <a
            href={template.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Where do I find this?
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {existing?.hasApiKey && (
          <p className="text-xs text-muted-foreground">
            Current key: <span className="font-mono">{existing.maskedApiKey}</span>
            {" · "}Leave blank to keep existing key.
          </p>
        )}
        <SecureInput
          value={apiKey}
          onChange={setApiKey}
          placeholder={existing?.hasApiKey ? "Leave blank to keep current key" : "Paste your API key"}
          id={`engine-api-key-${template.type}`}
        />
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label
          htmlFor={`engine-model-${template.type}`}
          className="block text-xs font-medium text-muted-foreground"
        >
          Model Version
        </label>
        <select
          id={`engine-model-${template.type}`}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {template.availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
              {m === template.defaultModel ? " (recommended)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Fallback Model */}
      <div className="space-y-1.5">
        <label
          htmlFor={`engine-fallback-${template.type}`}
          className="block text-xs font-medium text-muted-foreground"
        >
          Fallback Model
        </label>
        <select
          id={`engine-fallback-${template.type}`}
          value={fallbackModel}
          onChange={(e) => setFallbackModel(e.target.value)}
          className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <option value="">None</option>
          {template.availableModels
            .filter((m) => m !== model)
            .map((m) => (
              <option key={m} value={m}>
                {m}
                {m === template.defaultFallback ? " (recommended)" : ""}
              </option>
            ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Used automatically if the primary model is busy or unavailable.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-9 min-w-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
});
