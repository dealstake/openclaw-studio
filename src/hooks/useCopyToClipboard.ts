"use client";

import { useCallback, useState } from "react";

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

  const copyToClipboard = useCallback(
    (value: string) => {
      if (!value) return;
      navigator.clipboard.writeText(value).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), copiedDuration);
      });
    },
    [copiedDuration],
  );

  return { isCopied, copyToClipboard };
}
