"use client";

import React, { useCallback, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Loader2 } from "lucide-react";
import { SecureInput } from "@/components/ui/SecureInput";
import type { ChannelFieldDef, ChannelTemplate } from "../lib/types";

export interface ChannelSetupFormProps {
  template: ChannelTemplate;
  initialValues?: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  saving?: boolean;
}

function FieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: ChannelFieldDef;
  value: string;
  onChange: (key: string, val: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const inputId = `channel-field-${id}`;

  return (
    <div className="space-y-1.5">
      {field.type === "secret" ? (
        <SecureInput
          id={inputId}
          label={field.label}
          placeholder={field.placeholder}
          required={field.required}
          value={value}
          onChange={(v) => onChange(field.key, v)}
          disabled={disabled}
        />
      ) : (
        <>
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {field.label}
            {field.required && (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {field.type === "select" ? (
            <select
              id={inputId}
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              disabled={disabled}
              autoComplete="off"
              className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
            />
          )}
        </>
      )}

      {field.helpText && (
        <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug">
          {field.helpText}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const ChannelSetupForm = React.memo(function ChannelSetupForm({
  template,
  initialValues,
  onSave,
  onCancel,
  saving,
}: ChannelSetupFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const field of template.fields) {
      if (field.type === "select" && field.options?.length) {
        defaults[field.key] = String(initialValues?.[field.key] ?? field.options[0].value);
      } else {
        defaults[field.key] = String(initialValues?.[field.key] ?? "");
      }
    }
    return defaults;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of template.fields) {
      if (field.required && !(values[field.key] ?? "").trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [template.fields, values]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      // Filter out empty optional fields before saving
      const output: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(values)) {
        if (val.trim()) output[key] = val.trim();
      }
      onSave(output);
    },
    [validate, values, onSave],
  );

  const saveButtonText = template.hasQrFlow ? "Start Pairing" : "Save";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Setup instructions */}
      {template.setupInstructions && (
        <div className="rounded-md bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mt-0.5 [&_p]:mt-0.5">
          <ReactMarkdown>{template.setupInstructions}</ReactMarkdown>
        </div>
      )}

      {/* Docs link */}
      {template.docsUrl && (
        <a
          href={template.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary w-fit"
        >
          View docs
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Channel-specific fields */}
      {template.fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          onChange={handleChange}
          error={errors[field.key]}
          disabled={saving}
        />
      ))}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px] rounded-md px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving…" : saveButtonText}
        </button>
      </div>
    </form>
  );
});
