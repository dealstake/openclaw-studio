import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { MessagePart } from "@/lib/chat/types";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { AlertCircle, ArrowUp, Square, UploadCloud, WifiOff } from "lucide-react";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
// AgentAvatar available for future composer enhancements
import { ComposerAgentMenu, type ComposerAgent } from "./ComposerAgentMenu";
import { useFileUpload, type ChatAttachment } from "../hooks/useFileUpload";
import type { WizardType, WizardTheme, WizardStarter } from "@/features/wizards/lib/wizardTypes";
import { WizardBanner } from "@/features/wizards/components/WizardBanner";
import { useVoiceOutput, resolvedToSpeakOptions } from "@/features/voice/hooks/useVoiceOutput";
import { useElevenLabsKey } from "@/features/voice/hooks/useElevenLabsKey";
import { useVoiceSettings } from "@/features/voice/hooks/useVoiceSettings";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { VoiceInputControl } from "@/features/voice/components/VoiceControls";
import { VoiceModeButton } from "@/features/voice/components/VoiceModeButton";
import { useVoiceModeBridge } from "@/features/voice/hooks/useVoiceModeBridge";
import { useVoiceModeSafe } from "@/features/voice/providers/VoiceModeProvider";
import type { SpeechInputData } from "@/components/ui/speech-input";

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
  messageParts: _messageParts,
  runStartedAt: _runStartedAt,
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
  /** Latest assistant message text — used for TTS when voice output is enabled */
  lastAssistantText?: string;
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

  // When wizard is active, use wizard streaming state instead of main agent running state
  const isRunning = wizardType ? (wizardIsStreaming ?? false) : running;

  // ── Voice controls ────────────────────────────────────────────────────
  const { apiKey: elevenLabsKey } = useElevenLabsKey();
  const voiceOutput = useVoiceOutput({ apiKey: elevenLabsKey });
  const voiceSettingsCoordinator = useMemo(
    () => createStudioSettingsCoordinator({ debounceMs: 200 }),
    [],
  );
  const { settings: voiceResolvedSettings } = useVoiceSettings({
    settingsCoordinator: voiceSettingsCoordinator,
    apiKey: elevenLabsKey,
  });

  // Stable ref for voiceOutput to avoid re-creating callbacks
  const voiceOutputRef = useRef(voiceOutput);
  useEffect(() => {
    voiceOutputRef.current = voiceOutput;
  }, [voiceOutput]);

  // ── Voice mode bridge (full-screen overlay STT↔TTS↔Agent loop) ──────
  const voiceMode = useVoiceModeSafe();
  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);

  const { speakResponse: bridgeSpeakResponse } = useVoiceModeBridge({
    onUserMessage: useCallback(
      (text: string) => {
        onSend(text);
      },
      [onSend],
    ),
  });

  /** When voice transcript updates, sync it into the textarea */
  const handleVoiceChange = useCallback((data: SpeechInputData) => {
    const el = localRef.current;
    if (el) {
      el.value = data.transcript;
      setIsEmpty(!data.transcript.trim());
      onDraftChange(data.transcript);
    }
  }, [onDraftChange]);

  /** When voice recording starts, enable voice output for auto-speak */
  const handleVoiceStart = useCallback(() => {
    voiceOutputRef.current.setEnabled(true);
  }, []);

  /** When voice input stops, auto-send the transcript */
  const handleVoiceStop = useCallback((data: SpeechInputData) => {
    const text = data.transcript.trim();
    if (!text) return;
    onSend(text);
    const el = localRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
    }
    setIsEmpty(true);
    onDraftChange("");
  }, [onSend, onDraftChange]);

  /** When voice input is cancelled, clear the textarea */
  const handleVoiceCancel = useCallback(() => {
    const el = localRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
    }
    setIsEmpty(true);
    onDraftChange("");
  }, [onDraftChange]);

  /** Auto-speak assistant responses when voice is active (overlay or inline) */
  const prevRunningRef = useRef(false);
  const prevAssistantTextRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Detect transition from running → not running with new text
    if (prevRunningRef.current && !isRunning && lastAssistantText) {
      if (lastAssistantText !== prevAssistantTextRef.current) {
        // Strip markdown for cleaner speech
        const plainText = lastAssistantText
          .replace(/```[\s\S]*?```/g, " code block ")
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/#{1,6}\s/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/\n{2,}/g, ". ")
          .trim();
        if (plainText.length > 0 && plainText.length < 5000) {
          if (voiceModeActive) {
            // Voice overlay is open — use bridge (updates overlay state + TTS)
            void bridgeSpeakResponse(plainText);
          } else if (voiceOutput.enabled || voiceResolvedSettings.autoSpeak) {
            // Inline mic mode or auto-speak setting enabled — use direct TTS
            void voiceOutput.speak(plainText, resolvedToSpeakOptions(voiceResolvedSettings));
          }
        }
        prevAssistantTextRef.current = lastAssistantText;
      }
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, lastAssistantText, voiceOutput, voiceModeActive, bridgeSpeakResponse, voiceResolvedSettings]);

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
      // User is typing — exit voice mode
      if (voiceOutputRef.current.enabled && value.trim()) {
        voiceOutputRef.current.setEnabled(false);
      }
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
        {/* Wizard banner — floats above the split row */}
        {wizardType && wizardTheme && onWizardExit && (
          <div className="mb-2 rounded-2xl border border-border/50 glass-panel dark:bg-background/40">
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

        {/* Minimal status strip — only offline/errors/attachments, no streaming chrome */}
        {((gatewayStatus && gatewayStatus !== "connected") || fileError || hasFiles) && (
          <div className="mb-2 rounded-2xl border border-border/50 glass-panel px-4 py-2 dark:bg-background/40 animate-in slide-in-from-bottom-2 fade-in duration-200">
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

        {/* ═══ FLOATING ROW: [━━ Glass Input Pill ━━] [Morphing Button ○] ═══ */}
        <div className="flex items-end gap-2 sm:gap-2.5">

          {/* ── Glass Input Pill ── */}
          <div className="min-w-0 flex-1 rounded-[20px] border border-border/50 glass-panel transition-all focus-within:border-border/80 focus-within:shadow-2xl dark:bg-background/40 dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-end">
              {/* Voice controls — left side of pill */}
              <div className="flex shrink-0 items-center gap-0.5 pl-2 pb-1.5">
                <VoiceInputControl
                  onChange={handleVoiceChange}
                  onStart={handleVoiceStart}
                  onStop={handleVoiceStop}
                  onCancel={handleVoiceCancel}
                />
                {selectedAgentId && (
                  <VoiceModeButton agentId={selectedAgentId} />
                )}
              </div>
              <textarea
                ref={handleRef}
                rows={1}
                defaultValue={initialDraft}
                className="max-h-[200px] min-h-[36px] w-full resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
                aria-label="Message to agent"
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onPaste={handlePaste}
                placeholder={wizardType && wizardTheme ? "Describe what you need..." : `Message ${agentName}...`}
              />
            </div>
          </div>

          {/* ── Morphing Action Button — same size, same spot, 3 states ── */}
          <div className="relative shrink-0">
            {/* SVG progress ring — visible when running and tokenPct available */}
            {isRunning && tokenPct !== null && (
              <svg
                className="pointer-events-none absolute inset-0 -rotate-90"
                viewBox="0 0 48 48"
                width="48"
                height="48"
                aria-hidden
              >
                <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                <circle
                  cx="24" cy="24" r="21" fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className={`transition-all duration-700 ${tokenPct >= 80 ? "text-yellow-500" : "text-primary"}`}
                  stroke="currentColor"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - Math.min(tokenPct, 100) / 100)}`}
                />
              </svg>
            )}
            {isRunning && tokenPct === null && (
              <div className="absolute inset-[-3px] rounded-full border-2 border-primary/50 animate-pulse" aria-hidden />
            )}
            <AnimatePresence mode="wait" initial={false}>
            {/* State 1: Running → Stop button (wizard-aware) */}
            {isRunning ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg ring-1 ring-white/[0.06] backdrop-blur-xl hover:brightness-110 active:scale-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Stop agent"
                onClick={onStop}
                disabled={!canSend || stopBusy}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : !isEmpty || hasFiles ? (
              /* State 2: Has text/files → Send button */
              <motion.button
                key="send"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-white/[0.06] backdrop-blur-xl hover:brightness-110 active:scale-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                type="button"
                aria-label="Send message"
                onClick={handleClickSend}
                disabled={sendDisabled}
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </motion.button>
            ) : selectedAgentId && voiceMode ? (
              /* State 3a: Idle + mobile → Voice mode primary button (< 768px) */
              /* State 3b: Idle + desktop → Avatar (agent menu) (≥ 768px) */
              <>
                {/* Mobile: voice mode button */}
                <motion.div
                  key="voice-mobile"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="sm:hidden"
                >
                  <VoiceModeButton agentId={selectedAgentId} variant="primary" />
                </motion.div>
                {/* Desktop: agent menu (unchanged) */}
                {composerAgents && composerAgents.length > 0 && onSelectAgent && (
                  <motion.div
                    key="avatar"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="hidden sm:block"
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
                )}
              </>
            ) : (
              /* Fallback: disabled send button */
              <motion.button
                key="disabled"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/30 bg-background/60 text-muted-foreground shadow-lg ring-1 ring-white/[0.06] backdrop-blur-xl dark:bg-background/40"
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
