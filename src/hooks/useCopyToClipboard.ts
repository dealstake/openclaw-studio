"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared hook for copy-to-clipboard with auto-reset "copied" state.
 *
 * @param copiedDuration - ms before `isCopied` resets to false (default 3000)
 */
export function useCopyToClipboard({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clean up timer on unmount to prevent state update on unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyToClipboard = useCallback(
    (value: string) => {
      if (!value) return;
      navigator.clipboard.writeText(value).then(() => {
        setIsCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setIsCopied(false), copiedDuration);
      }).catch((err: unknown) => {
        console.warn("Clipboard write failed:", err);
      });
    },
    [copiedDuration],
  );

  return { isCopied, copyToClipboard };
}
