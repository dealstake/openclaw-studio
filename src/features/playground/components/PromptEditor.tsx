"use client";

import { memo, useCallback, useId, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { sectionLabelClass } from "@/components/SectionLabel";

interface PromptEditorProps {
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  userMessage: string;
  onUserMessageChange: (v: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const PromptEditor = memo(function PromptEditor({
  systemPrompt,
  onSystemPromptChange,
  userMessage,
  onUserMessageChange,
  onSubmit,
  onAbort,
  isStreaming,
  disabled = false,
}: PromptEditorProps) {
  const sysId = useId();
  const userMsgId = useId();

  const handleUserKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter or Ctrl+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isStreaming && userMessage.trim()) {
          onSubmit();
        }
      }
    },
    [isStreaming, userMessage, onSubmit]
  );

  const canSubmit = !isStreaming && !disabled && userMessage.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* System prompt */}
      <div className="flex flex-col gap-1">
        <label htmlFor={sysId} className={`${sectionLabelClass} text-muted-foreground`}>
          System prompt
        </label>
        <textarea
          id={sysId}
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="You are a helpful assistant…"
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs
            text-foreground placeholder:text-muted-foreground transition-colors
            focus:outline-none focus:ring-1 focus:ring-primary/50
            disabled:cursor-not-allowed disabled:opacity-50 font-mono leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* User message */}
      <div className="flex flex-col gap-1">
        <label htmlFor={userMsgId} className={`${sectionLabelClass} text-muted-foreground`}>
          User message
          <span className="ml-2 hidden font-normal text-muted-foreground normal-case tracking-normal sm:inline">⌘↵ to send</span>
        </label>
        <div className="relative">
          <textarea
            id={userMsgId}
            value={userMessage}
            onChange={(e) => onUserMessageChange(e.target.value)}
            onKeyDown={handleUserKeyDown}
            disabled={disabled}
            rows={3}
            placeholder="Enter your test prompt…"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 pr-10 text-xs
              text-foreground placeholder:text-muted-foreground transition-colors
              focus:outline-none focus:ring-1 focus:ring-primary/50
              disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed"
            spellCheck={false}
          />
          <div className="absolute bottom-2 right-2">
            {isStreaming ? (
              <IconButton
                onClick={onAbort}
                aria-label="Stop generation"
                title="Stop generation"
                variant="destructive"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </IconButton>
            ) : (
              <IconButton
                onClick={onSubmit}
                aria-label="Run prompt"
                title="Run prompt (⌘↵)"
                variant="primary"
                disabled={!canSubmit}
              >
                <Send className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
