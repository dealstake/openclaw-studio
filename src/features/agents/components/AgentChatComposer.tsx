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
import { motion, AnimatePresence } from "framer-motion";

import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { AlertCircle, ArrowUp, Mic, MicOff, Square, UploadCloud, WifiOff } from "lucide-react";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { ComposerAgentMenu, type ComposerAgent } from "./ComposerAgentMenu";
import { useFileUpload, type ChatAttachment } from "../hooks/useFileUpload";
import type { WizardType, WizardTheme, WizardStarter } from "@/features/wizards/lib/wizardTypes";
import { WizardBanner } from "@/features/wizards/components/WizardBanner";
import { WizardLaunchMenu } from "@/features/wizards/components/WizardLaunchMenu";
import { useInlineVoice } from "@/features/voice/hooks/useInlineVoice";
import { InlineVoiceIndicator } from "@/features/voice/components/InlineVoiceIndicator";

import { stripAnsi } from "@/lib/stripAnsi";

/** Strip markdown syntax for cleaner speech output */
function stripMarkdownForSpeech(text: string): string {
  return stripAnsi(text)
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

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
  lastAssistantText,
  onLaunchWizard,
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
  lastAssistantText?: string;
  onLaunchWizard?: (type: WizardType) => void;
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

  const isRunning = wizardType ? (wizardIsStreaming ?? false) : running;

  // ── Inline Voice ──────────────────────────────────────────────────
  const inlineVoice = useInlineVoice({
    onUserMessage: useCallback((text: string) => {
      onSend(text);
    }, [onSend]),
    agentId: selectedAgentId,
  });

  // Auto-speak agent responses when inline voice is active
  const prevRunningRef = useRef(false);
  const prevAssistantTextRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevRunningRef.current && !isRunning && lastAssistantText && inlineVoice.isActive) {
      if (lastAssistantText !== prevAssistantTextRef.current) {
        const prevText = prevAssistantTextRef.current || "";
        const newText = lastAssistantText.startsWith(prevText)
          ? lastAssistantText.slice(prevText.length).trim()
          : lastAssistantText;
        let plainText = stripMarkdownForSpeech(newText);
        if (plainText.length >= 5000) plainText = plainText.slice(0, 4000);

        if (plainText.length > 0) {
          void inlineVoice.speakResponse(plainText);
        }
        prevAssistantTextRef.current = lastAssistantText;
      }
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, lastAssistantText, inlineVoice]);

  // ── Voice toggle handler ──────────────────────────────────────────
  const handleVoiceToggle = useCallback(() => {
    if (inlineVoice.isActive) {
      inlineVoice.stop();
    } else {
      void inlineVoice.start();
    }
  }, [inlineVoice]);

  // ── File / Input handlers ─────────────────────────────────────────

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
      const el = event.target;
      const value = el.value;
      setIsEmpty(!value.trim());
      onDraftChange(value);
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
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

  const sendDisabled = !canSend || isRunning || (isEmpty && !hasFiles) || isEncoding;

  const tokenPct = tokenUsed && tokenLimit && tokenLimit > 0
    ? Math.round((tokenUsed / tokenLimit) * 100)
    : null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-3 sm:px-4"
      style={{ paddingBottom: `calc(1.25rem + var(--mobile-nav-height, 0px) + env(safe-area-inset-bottom))` }}
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

      <div className="mx-auto max-w-3xl 2xl:max-w-4xl">
        {/* Wizard banner — desktop only */}
        {wizardType && wizardTheme && onWizardExit && (
          <div className="mb-2 hidden rounded-2xl border border-border/50 glass-panel dark:bg-background/40 sm:block">
            <WizardBanner
              type={wizardType}
              theme={wizardTheme}
              starters={!wizardHasMessages ? wizardStarters : undefined}
              onExit={onWizardExit}
              onStarterClick={onWizardStarterClick}
              isStreaming={wizardIsStreaming}
            />
          </div>
        )}
        {/* Mobile wizard starters */}
        {wizardType && wizardTheme && !wizardHasMessages && wizardStarters && wizardStarters.length > 0 && onWizardStarterClick && (
          <div className="mb-2 flex flex-wrap gap-1.5 sm:hidden">
            {wizardStarters.map((starter) => (
              <button
                key={starter.label}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted/50 ${wizardTheme.border} ${wizardTheme.accent}`}
                onClick={() => onWizardStarterClick(starter.message)}
              >
                {starter.label}
              </button>
            ))}
          </div>
        )}

        {/* Status strip */}
        {((gatewayStatus && gatewayStatus !== "connected") || fileError || hasFiles) && (
          <div className="mb-2 rounded-2xl border border-border/30 bg-background/95 px-4 py-2 shadow-sm animate-in slide-in-from-bottom-2 fade-in duration-200">
            {gatewayStatus && gatewayStatus !== "connected" && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400" role="status">
                <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {gatewayStatus === "connecting" ? "Reconnecting…" : "Offline"}
                  {(queueLength ?? 0) > 0 && ` · ${queueLength} queued`}
                </span>
              </div>
            )}
            {fileError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{fileError}</span>
              </div>
            )}
            {hasFiles && <ChatAttachmentPreview files={files} onRemove={removeFile} />}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptString}
          multiple
          onChange={handleFileInputChange}
        />

        {/* ═══ COMPOSER ROW ═══ */}
        <div className="flex items-end gap-2 sm:gap-2.5">

          {/* ── Glass Input Pill ── */}
          <div className="min-w-0 flex-1 rounded-[24px] border border-border/30 bg-background shadow-sm transition-colors focus-within:border-border/50">
            <div className="flex items-end">
              {/* Left controls */}
              <div className="flex shrink-0 items-center gap-1 pl-2 pb-1.5 sm:pl-2.5">
                {!wizardType && onLaunchWizard && (
                  <WizardLaunchMenu onLaunch={onLaunchWizard} disabled={isRunning} />
                )}
                {/* Inline voice mic button */}
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    inlineVoice.isActive
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  aria-label={inlineVoice.isActive ? "Stop voice mode" : "Start voice mode"}
                  title={inlineVoice.isActive ? "Stop voice mode" : "Start voice mode"}
                >
                  {inlineVoice.isActive ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
                {/* Inline voice state indicator */}
                <InlineVoiceIndicator state={inlineVoice.state} />
              </div>
              <textarea
                ref={handleRef}
                rows={1}
                defaultValue={initialDraft}
                className="max-h-[200px] min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-foreground outline-none! placeholder:text-muted-foreground/60"
                aria-label="Message to agent"
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onPaste={handlePaste}
                placeholder={wizardType && wizardTheme ? "Type your requirements or pick a template..." : `Message ${agentName}...`}
              />
            </div>
          </div>

          {/* ── Morphing Action Button ── */}
          <div className="relative shrink-0">
            {isRunning && tokenPct !== null && (
              <svg
                className="pointer-events-none absolute inset-0 -rotate-90"
                viewBox="0 0 44 44"
                width="44"
                height="44"
                aria-hidden
              >
                <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                <circle
                  cx="22" cy="22" r="19" fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={`transition-all duration-700 ${tokenPct >= 80 ? "text-yellow-500" : "text-primary"}`}
                  stroke="currentColor"
                  strokeDasharray={`${2 * Math.PI * 19}`}
                  strokeDashoffset={`${2 * Math.PI * 19 * (1 - Math.min(tokenPct, 100) / 100)}`}
                />
              </svg>
            )}
            {isRunning && tokenPct === null && (
              <div className="absolute inset-[-3px] rounded-full border-2 border-primary/50 animate-pulse" aria-hidden />
            )}
            <AnimatePresence mode="wait" initial={false}>
            {isRunning ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm ring-1 ring-white/[0.06] transition-all hover:bg-destructive/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Stop agent"
                onClick={onStop}
                disabled={!canSend || stopBusy}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : !isEmpty || hasFiles ? (
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-1 ring-white/[0.06] transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Send message"
                onClick={handleClickSend}
                disabled={sendDisabled}
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </motion.button>
            ) : composerAgents && composerAgents.length > 0 && onSelectAgent && selectedAgentId ? (
              <motion.div
                key="avatar"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
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
              </motion.div>
            ) : (
              <motion.button
                key="disabled"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-border/20 bg-muted/30 text-muted-foreground shadow-sm ring-1 ring-white/[0.06]"
                type="button"
                aria-label="Send message"
                disabled
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </motion.button>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
