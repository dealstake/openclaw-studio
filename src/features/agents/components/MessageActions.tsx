import { memo, useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

type MessageActionsProps = {
  text: string;
};

/** Copy-to-clipboard button that appears on hover over a chat message. */
export const MessageActions = memo(function MessageActions({ text }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (copied || !text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [copied, text]);

  return (
    <div className="pointer-events-none absolute -top-3 right-1 z-10 opacity-0 transition-opacity group-hover/message:pointer-events-auto group-hover/message:opacity-100">
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-border/80 bg-card shadow-sm transition hover:bg-muted"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy message"}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
});
