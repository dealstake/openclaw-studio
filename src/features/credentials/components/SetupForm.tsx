"use client";

import React, { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import type { CredentialTemplate, CredentialValues } from "../lib/types";
import { SecureInput } from "./SecureInput";

export interface SetupFormProps {
  template: CredentialTemplate;
  initialValues?: CredentialValues;
  onSave: (
    values: CredentialValues,
    overrides: {
      humanName?: string;
      description?: string;
      customConfigPath?: string;
    },
  ) => void;
  onCancel: () => void;
  saving?: boolean;
}

export const SetupForm = React.memo(function SetupForm({
  template,
  initialValues,
  onSave,
  onCancel,
  saving,
}: SetupFormProps) {
  const [values, setValues] = useState<CredentialValues>(
    () => initialValues ?? {},
  );
  const [humanName, setHumanName] = useState(template.serviceName);
  const [customConfigPath, setCustomConfigPath] = useState("");
  const isCustom = template.key === "custom";

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSave(values, {
        humanName,
        customConfigPath: isCustom ? customConfigPath : undefined,
      });
    },
    [values, humanName, customConfigPath, isCustom, onSave],
  );

  const allRequiredFilled =
    template.fields
      .filter((f) => f.required)
      .every((f) => {
        const v = values[f.id];
        return typeof v === "string" && v.trim().length > 0;
      }) && (!isCustom || customConfigPath.trim().length > 0);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Service header */}
      <div>
        <h3 className="text-sm font-medium text-foreground">
          {template.serviceName}
        </h3>
        {template.apiKeyPageUrl && (
          <a
            href={template.apiKeyPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary"
          >
            Get credentials
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Instructions */}
      {template.instructions && (
        <div className="rounded-md bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline">
          <ReactMarkdown>{template.instructions}</ReactMarkdown>
        </div>
      )}

      {/* Display name */}
      <div className="space-y-1.5">
        <label
          htmlFor="cred-name"
          className="block text-xs font-medium text-muted-foreground"
        >
          Display Name
        </label>
        <input
          id="cred-name"
          type="text"
          value={humanName}
          onChange={(e) => setHumanName(e.target.value)}
          className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
      </div>

      {/* Config path (custom template only) */}
      {isCustom && (
        <div className="space-y-1.5">
          <label
            htmlFor="cred-config-path"
            className="block text-xs font-medium text-muted-foreground"
          >
            Config Path <span className="text-destructive">*</span>
          </label>
          <input
            id="cred-config-path"
            type="text"
            value={customConfigPath}
            onChange={(e) => setCustomConfigPath(e.target.value)}
            placeholder="e.g. skills.entries.myservice.apiKey"
            className="h-9 w-full rounded-md border border-border/50 bg-background px-3 font-mono text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          <p className="text-[11px] leading-snug text-muted-foreground/70">
            The dotted config path where the secret will be stored.
          </p>
        </div>
      )}

      {/* Secret fields */}
      {template.fields.map((field) => (
        <SecureInput
          key={field.id}
          id={`cred-${field.id}`}
          label={field.label}
          placeholder={field.placeholder}
          required={field.required}
          value={values[field.id] ?? ""}
          onChange={(v) => handleFieldChange(field.id, v)}
          disabled={saving}
        />
      ))}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-md px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !allRequiredFilled}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
});
