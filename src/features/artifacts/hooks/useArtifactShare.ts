"use client";

import { useCallback, useState } from "react";

/**
 * Hook for sharing a Drive artifact via "anyone with the link".
 *
 * Calls POST /api/artifacts/share → receives a shareable webViewLink →
 * copies it to the clipboard. Returns loading and error state for UI feedback.
 */
export function useArtifactShare() {
  const [sharing, setSharingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shareFile = useCallback(async (fileId: string) => {
    setSharingId(fileId);
    setShareError(null);

    try {
      const res = await fetch("/api/artifacts/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (!res.ok) {
        let message = `Share failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON body
        }
        setShareError(message);
        return;
      }

      const data = (await res.json()) as { shareLink?: string };
      const link = data.shareLink;

      if (!link) {
        setShareError("No share link returned from server.");
        return;
      }

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(link);
        setCopiedId(fileId);
        // Clear "copied" state after 2 seconds
        setTimeout(() => setCopiedId((id) => (id === fileId ? null : id)), 2_000);
      } catch {
        // Clipboard write failed (e.g. non-HTTPS) — open in new tab instead
        window.open(link, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to share file.");
    } finally {
      setSharingId(null);
    }
  }, []);

  const clearShareError = useCallback(() => setShareError(null), []);

  return {
    /** File ID currently being shared (or null) */
    sharing,
    /** Error message from last share attempt (or null) */
    shareError,
    /** File ID whose link was just copied (cleared after 2s, or null) */
    copiedId,
    /** Share a file by ID → make public → copy link to clipboard */
    shareFile,
    /** Dismiss the share error banner */
    clearShareError,
  };
}
