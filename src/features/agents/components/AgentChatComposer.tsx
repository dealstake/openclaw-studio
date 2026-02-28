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
import { AlertCircle, ArrowUp, Square, UploadCloud, WifiOff } from "lucide-react";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { ComposerAgentMenu, type ComposerAgent } from "./ComposerAgentMenu";
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
  composerAgents,
  selectedAgentId,
  onSelectAgent,
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
  wizardType?: WizardType | null;
  wizardTheme?: WizardTheme | null;
  wizardStarters?: WizardStarter[];
  wizardIsStreaming?: boolean;
  wizardHasMessages?: boolean;
  onWizardExit?: () => void;
  onWizardStarterClick?: (message: string) => void;
  onNewSession?: () => void;
  composerAgents?: ComposerAgent[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
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

  const triggerAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <UploadCloud className="mb-2 h-10 w-10 animate-bounce text-primary" />
          <span className="text-sm font-medium text-foreground">Drop files here</span>
        </div>
      )}

      {/* Gradient fade */}
      <div className="pointer-events-none h-4 sm:h-8 bg-gradient-to-t from-background to-transparent" />

      {/* Glassmorphic composer card */}
      <div className={`mx-auto flex max-w-3xl flex-col rounded-[24px] border transition-all duration-200 ${wizardType && wizardTheme ? `${wizardTheme.border} border-opacity-40 bg-popover` : "border-border/50 bg-background/70 shadow-2xl ring-1 ring-white/[0.08] backdrop-blur-xl focus-within:border-border/80 dark:bg-background/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"}`}>

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
          <div className="flex items-center gap-1.5 rounded-t-[24px] bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400" role="status">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {gatewayStatus === "connecting" ? "Reconnecting…" : "Offline"}
              {(queueLength ?? 0) > 0 && ` · ${queueLength} message${(queueLength ?? 0) > 1 ? "s" : ""} queued`}
            </span>
          </div>
        )}

        {/* File error */}
        {fileError && (
          <div className="flex items-center gap-1.5 rounded-t-[24px] bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fileError}</span>
          </div>
        )}

        {/* Attachment preview */}
        {hasFiles && (
          <div className="px-4 pt-3">
            <ChatAttachmentPreview files={files} onRemove={removeFile} />
          </div>
        )}

        {/* Streaming expanded state */}
        {running && (
          <div className="flex items-center gap-3 border-b border-border/20 px-4 py-2.5 animate-in slide-in-from-top-2 fade-in duration-200">
            <StreamingStatus
              running={running}
              messageParts={messageParts ?? []}
              runStartedAt={runStartedAt}
            />
            <div className="flex-1" />
            {tokenPct !== null && (
              <div className="flex items-center gap-2 opacity-80">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/50 sm:w-24">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/70"}`}
                    style={{ width: `${Math.min(tokenPct, 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{tokenPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input (triggered from dropdown) */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptString}
          multiple
          onChange={handleFileInputChange}
        />

        {/* Single-line input: [textarea] [avatar button] [send/stop] */}
        <div className="flex items-end gap-1.5 p-2 sm:p-2.5">
          {/* Textarea */}
          <textarea
            ref={handleRef}
            rows={1}
            defaultValue={initialDraft}
            className="max-h-[200px] min-h-[36px] flex-1 resize-none self-center bg-transparent px-2 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Message to agent"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPaste={handlePaste}
            placeholder={wizardType && wizardTheme ? "Describe what you need..." : `Message ${agentName}...`}
          />

          {/* Agent avatar button (unified dropdown trigger) */}
          {composerAgents && composerAgents.length > 0 && selectedAgentId && onSelectAgent && (
            <div className="mb-[1px] shrink-0">
              <ComposerAgentMenu
                agents={composerAgents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={onSelectAgent}
                models={models}
                modelValue={modelValue}
                onModelChange={onModelChange}
                thinkingLevel={thinkingLevel}
                onThinkingChange={onThinkingChange}
                allowThinking={allowThinking}
                tokenPct={tokenPct}
                onNewSession={onNewSession}
                onAttach={triggerAttach}
              />
            </div>
          )}

          {/* Send / Stop */}
          <div className="mb-[1px] shrink-0">
            {running ? (
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Stop agent"
                onClick={onStop}
                disabled={!canSend || stopBusy}
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
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
      </div>
    </div>
  );
});
