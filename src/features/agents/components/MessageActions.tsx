import { memo } from "react";
import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

type MessageActionsProps = {
  text: string;
};

/** Copy-to-clipboard button that appears on hover over a chat message. */
export const MessageActions = memo(function MessageActions({ text }: MessageActionsProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 2000 });
  const snippet = text.length > 40 ? `${text.slice(0, 40)}…` : text;

  return (
    <div className="pointer-events-none absolute -top-3 right-1 z-10 opacity-0 transition-opacity group-hover/message:pointer-events-auto group-hover/message:opacity-100">
      <button
        type="button"
        className="flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border/80 bg-card shadow-sm transition hover:bg-muted"
        onClick={() => copyToClipboard(text)}
        aria-label={isCopied ? "Copied" : `Copy message: ${snippet}`}
        title={isCopied ? "Copied!" : "Copy to clipboard"}
      >
        {isCopied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
});
