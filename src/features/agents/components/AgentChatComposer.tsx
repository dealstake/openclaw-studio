import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { MessagePart } from "@/lib/chat/types";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { AlertCircle, Paperclip, Plus, Send, Square, UploadCloud, WifiOff } from "lucide-react";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { ModelPicker } from "./ModelPicker";
import { ThinkingToggle } from "./ThinkingToggle";
import { StreamingStatus } from "./StreamingStatus";
import { useFileUpload, type ChatAttachment } from "../hooks/useFileUpload";
import type { WizardType, WizardTheme, WizardStarter } from "@/features/wizards/lib/wizardTypes";
import { WizardBanner } from "@/features/wizards/components/WizardBanner";

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
  messageParts,
  runStartedAt,
  gatewayStatus,
  queueLength,
  wizardType,
  wizardTheme,
  wizardStarters,
  wizardIsStreaming,
  wizardHasMessages,
  onWizardExit,
  onWizardStarterClick,
  onNewSession,
}: {
  onDraftChange: (value: string) => void;
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
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
  messageParts?: MessagePart[];
  runStartedAt?: number | null;
  gatewayStatus?: GatewayStatus;
  queueLength?: number;
  /** Wizard mode props — when set, composer shows wizard banner */
  wizardType?: WizardType | null;
  wizardTheme?: WizardTheme | null;
  wizardStarters?: WizardStarter[];
  wizardIsStreaming?: boolean;
  wizardHasMessages?: boolean;
  onWizardExit?: () => void;
  onWizardStarterClick?: (message: string) => void;
  onNewSession?: () => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingResizeRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialDraft.trim());
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCountRef = useRef(0);
  const { files, addFiles, removeFile, clearFiles, getAttachments, hasFiles, isEncoding, acceptString } = useFileUpload();

  const showFileError = useCallback((msg: string) => {
    setFileError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setFileError(null), 4000);
  }, []);

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

  const doSend = useCallback(() => {
    const value = localRef.current?.value ?? "";
    const trimmed = value.trim();
    const attachments = getAttachments();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed || "(attached files)", attachments.length > 0 ? attachments : undefined);
    clearAfterSend();
    clearFiles();
  }, [onSend, clearAfterSend, getAttachments, clearFiles]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      doSend();
    },
    [doSend]
  );

  const handleClickSend = useCallback(() => {
    doSend();
  }, [doSend]);

  // ── Paste handler ──────────────────────────────────────────────────
  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        event.preventDefault();
        void addFiles(imageFiles).then((errs) => {
          if (errs && errs.length > 0) showFileError(errs[0]);
        });
      }
    },
    [addFiles, showFileError]
  );

  // ── Drag & drop handlers ──────────────────────────────────────────
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    if (dragCountRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
      if (droppedFiles.length > 0) {
        void addFiles(droppedFiles).then((errs) => {
          if (errs && errs.length > 0) showFileError(errs[0]);
        });
      }
    },
    [addFiles, showFileError]
  );

  // ── File input handler ─────────────────────────────────────────────
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) {
        void addFiles(selected).then((errs) => {
          if (errs && errs.length > 0) showFileError(errs[0]);
        });
      }
      e.target.value = "";
    },
    [addFiles, showFileError]
  );

  // Cleanup rAF + error timer on unmount
  useEffect(() => {
    return () => {
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
      }
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);



  const sendDisabled = !canSend || running || (isEmpty && !hasFiles) || isEncoding;

  const tokenPct = tokenUsed && tokenLimit && tokenLimit > 0
    ? Math.round((tokenUsed / tokenLimit) * 100)
    : null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-2 sm:px-4"
      style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <UploadCloud className="mb-2 h-10 w-10 animate-bounce text-primary" />
          <span className="text-sm font-medium text-foreground">Drop files here</span>
        </div>
      )}
      {/* Gradient fade above composer */}
      <div className="pointer-events-none h-3 sm:h-6 bg-gradient-to-t from-background to-transparent" />
      {/* Main composer card */}
      <div className={`mx-auto flex max-w-3xl flex-col rounded-xl border shadow-lg backdrop-blur-md focus-within:bg-card transition ${wizardType && wizardTheme ? `${wizardTheme.border} border-opacity-40 bg-card/80` : "border-border/30 bg-card/80 focus-within:border-border/60"}`}>
        {/* Wizard banner */}
        {wizardType && wizardTheme && onWizardExit && (
          <WizardBanner
            type={wizardType}
            theme={wizardTheme}
            starters={!wizardHasMessages ? wizardStarters : undefined}
            onExit={onWizardExit}
            onStarterClick={onWizardStarterClick}
            isStreaming={wizardIsStreaming}
          />
        )}

        {/* Offline indicator */}
        {gatewayStatus && gatewayStatus !== "connected" && (
          <div className="flex items-center gap-1.5 rounded-t-xl bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-400" role="status">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {gatewayStatus === "connecting" ? "Reconnecting…" : "Offline"}
              {(queueLength ?? 0) > 0 && ` · ${queueLength} message${(queueLength ?? 0) > 1 ? "s" : ""} queued`}
              {" — messages will send when reconnected"}
            </span>
          </div>
        )}

        {/* File error message */}
        {fileError && (
          <div className="flex items-center gap-1.5 rounded-t-xl bg-destructive/10 px-3 py-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fileError}</span>
          </div>
        )}

        {/* Attachment preview row */}
        {hasFiles && (
          <div className="px-3 pt-1.5">
            <ChatAttachmentPreview files={files} onRemove={removeFile} />
          </div>
        )}

        {/* Streaming status bar — shown above input only when active */}
        {running && (
          <div className="flex items-center gap-2 rounded-t-xl bg-card px-3 pt-1.5 pb-0.5">
            <StreamingStatus
              running={running}
              messageParts={messageParts ?? []}
              runStartedAt={runStartedAt}
            />
            {tokenPct !== null && (
              <div className="flex items-center gap-1.5 opacity-60">
                <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/60"}`}
                    style={{ width: `${Math.min(tokenPct, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{tokenPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* Row 1: Toolbar — model picker, thinking, token meter, new session */}
        <div className="flex min-h-[36px] items-center gap-1 overflow-x-auto border-b border-border/20 px-2.5 py-1 scrollbar-none">
          {/* Left: model picker + thinking toggle + token meter */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {models.length > 0 && (
              <ModelPicker models={models} value={modelValue} onChange={onModelChange} />
            )}
            {allowThinking && (
              <>
                <div className="h-3.5 w-px shrink-0 bg-border/30" />
                <ThinkingToggle value={thinkingLevel} onChange={onThinkingChange} />
              </>
            )}
            {tokenPct !== null && (
              <>
                <div className="hidden h-3.5 w-px shrink-0 bg-border/30 sm:block" />
                <div className="hidden items-center gap-1.5 opacity-70 sm:flex">
                  <div className="h-1 w-8 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/60"}`}
                      style={{ width: `${Math.min(tokenPct, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{tokenPct}%</span>
                </div>
              </>
            )}
          </div>

          {/* Right: new session button */}
          {onNewSession && (
            <button
              type="button"
              onClick={onNewSession}
              className="flex h-7 w-7 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="New session"
              title="New session"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Input — [attach] [textarea] [send/stop] */}
        <div className="flex items-end gap-1 px-2 py-1.5">
          {/* Attach button */}
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={acceptString}
              multiple
              onChange={handleFileInputChange}
            />
          </div>

          {/* Textarea — grows vertically */}
          <textarea
            ref={handleRef}
            rows={1}
            defaultValue={initialDraft}
            className="max-h-[200px] min-h-[36px] flex-1 resize-none self-center bg-transparent py-1.5 text-base leading-normal text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Message to agent"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPaste={handlePaste}
            placeholder={wizardType && wizardTheme ? `Describe what you need...` : `Message ${agentName}...`}
          />

          {/* Send/Stop */}
          <div className="flex shrink-0 items-center gap-1">
            {running ? (
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Stop agent"
                onClick={onStop}
                disabled={!canSend || stopBusy}
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Send message"
                onClick={handleClickSend}
                disabled={sendDisabled}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
