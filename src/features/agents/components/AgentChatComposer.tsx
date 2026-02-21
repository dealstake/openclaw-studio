import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type { GatewayModelChoice } from "@/lib/gateway/models";
import { ArrowUp, Plus, Square } from "lucide-react";

export const AgentChatComposer = memo(function AgentChatComposer({
  onDraftChange,
  onSend,
  onStop,
  onResize,
  canSend,
  stopBusy,
  running,
  inputRef,
  initialDraft,
  models,
  modelValue,
  onModelChange,
  thinkingLevel,
  onThinkingChange,
  tokenUsed,
  tokenLimit,
  agentName,
  allowThinking,
}: {
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onStop: () => void;
  onResize: () => void;
  canSend: boolean;
  stopBusy: boolean;
  running: boolean;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  initialDraft: string;
  models: GatewayModelChoice[];
  modelValue: string;
  onModelChange: (value: string | null) => void;
  thinkingLevel: string;
  onThinkingChange: (value: string | null) => void;
  tokenUsed?: number;
  tokenLimit?: number;
  agentName: string;
  allowThinking: boolean;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingResizeRef = useRef<number | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialDraft.trim());

  const handleRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    localRef.current = el instanceof HTMLTextAreaElement ? el : null;
    inputRef(el);
  }, [inputRef]);

  const handleFocus = useCallback(() => {
    const el = localRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "nearest" });
      });
    }
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setIsEmpty(!value.trim());
      onDraftChange(value);
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
      }
      pendingResizeRef.current = requestAnimationFrame(() => {
        pendingResizeRef.current = null;
        onResize();
      });
    },
    [onDraftChange, onResize]
  );

  const clearAfterSend = useCallback(() => {
    const el = localRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
    }
    setIsEmpty(true);
    onDraftChange("");
  }, [onDraftChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      const value = localRef.current?.value ?? "";
      const trimmed = value.trim();
      if (trimmed) {
        onSend(trimmed);
        clearAfterSend();
      }
    },
    [onSend, clearAfterSend]
  );

  const handleClickSend = useCallback(() => {
    const value = localRef.current?.value ?? "";
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      clearAfterSend();
    }
  }, [onSend, clearAfterSend]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
      }
    };
  }, []);

  // Mobile keyboard awareness
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
      document.documentElement.style.removeProperty("--keyboard-offset");
    };
  }, []);

  const sendDisabled = !canSend || running || isEmpty;

  const tokenPct = tokenUsed && tokenLimit && tokenLimit > 0
    ? Math.round((tokenUsed / tokenLimit) * 100)
    : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-4" style={{ paddingBottom: `calc(12px + env(safe-area-inset-bottom) + var(--keyboard-offset, 0px))` }}>
      {/* Gradient fade above composer */}
      <div className="pointer-events-none h-24 bg-gradient-to-t from-background via-background/80 to-transparent" />
      {/* Model / Thinking selectors above pill */}
      <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 px-1">
        {models.length > 0 && (
          <select
            className="h-10 rounded-full border border-border/60 bg-muted/50 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-muted focus:border-border sm:h-7 sm:px-2.5 sm:text-[11px]"
            value={modelValue}
            onChange={(e) => onModelChange(e.target.value || null)}
            aria-label="Select model"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        )}
        {allowThinking && (
          <select
            className="h-10 rounded-full border border-border/60 bg-muted/50 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-muted focus:border-border sm:h-7 sm:px-2.5 sm:text-[11px]"
            value={thinkingLevel}
            onChange={(e) => onThinkingChange(e.target.value || null)}
            aria-label="Thinking level"
          >
            <option value="off">Thinking: Off</option>
            <option value="low">Thinking: Low</option>
            <option value="medium">Thinking: Med</option>
            <option value="high">Thinking: High</option>
          </select>
        )}
        {tokenPct !== null && (
          <div className="ml-auto flex items-center gap-1.5 opacity-70">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/60"}`}
                style={{ width: `${Math.min(tokenPct, 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{tokenPct}%</span>
          </div>
        )}
      </div>

      {/* Main composer pill */}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/20 bg-card/80 p-2 shadow-lg backdrop-blur-md focus-within:border-border focus-within:bg-card transition">
        {/* Attach button placeholder */}
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted sm:h-9 sm:w-9"
          aria-label="Attach file"
          disabled
        >
          <Plus className="h-4 w-4" />
        </button>

        <textarea
          ref={handleRef}
          rows={1}
          defaultValue={initialDraft}
          className="max-h-[80px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:max-h-[200px]"
          aria-label="Message to agent"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={`Message ${agentName}...`}
        />

        {running ? (
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
            type="button"
            aria-label="Stop agent"
            onClick={onStop}
            disabled={!canSend || stopBusy}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
            type="button"
            aria-label="Send message"
            onClick={handleClickSend}
            disabled={sendDisabled}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});
