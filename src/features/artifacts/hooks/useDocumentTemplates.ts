"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocTemplateEntry } from "@/features/personas/lib/documentTemplates";

interface TemplatesResponse {
  templates: DocTemplateEntry[];
}

function isTemplatesResponse(value: unknown): value is TemplatesResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).templates)
  );
}

/**
 * Hook to fetch available document templates from all persona Starter Kits.
 * Calls GET /api/artifacts/templates and returns the flat list of DocTemplateEntry objects.
 */
export function useDocumentTemplates() {
  const [templates, setTemplates] = useState<DocTemplateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/artifacts/templates");
      if (!res.ok) {
        let message = `Failed to load templates (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON body
        }
        setError(message);
        return;
      }
      const data: unknown = await res.json();
      if (!isTemplatesResponse(data)) {
        setError("Unexpected response format from templates API.");
        return;
      }
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}
