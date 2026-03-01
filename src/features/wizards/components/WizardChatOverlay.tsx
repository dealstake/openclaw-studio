import { memo, useEffect, useRef } from "react";
import type { WizardMessage } from "../hooks/useWizardInChat";
import type { WizardExtractedConfig, WizardType } from "../lib/wizardTypes";
import { WizardMessageBubble } from "./WizardMessageBubble";
import { WizardConfigCard } from "./WizardConfigCard";
import { WizardPreflightCard } from "./WizardPreflightCard";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import type { PreflightResult } from "@/features/personas/lib/preflightTypes";

type WizardChatOverlayProps = {
  messages: WizardMessage[];
  streamText: string | null;
  thinkingTrace: string | null;
  isStreaming: boolean;
  wizardType: WizardType;
  extractedConfig: WizardExtractedConfig | null;
  onConfirmConfig: () => void;
  onReviseConfig: () => void;
  onCancelWizard: () => void;
  confirming?: boolean;
  /** Latest preflight result from a run_preflight tool call (null if none) */
  preflightResult?: PreflightResult | null;
  /** Called when user clicks "Install" for a missing skill */
  onInstallSkill?: (capability: string, clawhubPackage: string) => void;
  /** Called when user clicks "Enable" for a disabled skill */
  onEnableSkill?: (capability: string) => void;
  /** Called when user clicks "Set up credential" */
  onSetupCredential?: (templateKey: string) => void;
  /** Called when user clicks "Authenticate" for OAuth */
  onOAuthFlow?: (authUrl: string) => void;
  /** Called to re-run the preflight check */
  onRecheck?: () => void;
  /** Whether a re-check is in progress */
  rechecking?: boolean;
};

/**
 * Renders wizard messages inline in the chat area.
 * Shows themed message bubbles, streaming text, thinking traces,
 * and config preview cards.
 */
export const WizardChatOverlay = memo(function WizardChatOverlay({
  messages,
  streamText,
  thinkingTrace,
  isStreaming,
  wizardType,
  extractedConfig,
  onConfirmConfig,
  onReviseConfig,
  onCancelWizard,
  confirming = false,
  preflightResult = null,
  onInstallSkill,
  onEnableSkill,
  onSetupCredential,
  onOAuthFlow,
  onRecheck,
  rechecking = false,
}: WizardChatOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content — deferred to after paint cycle
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages.length, streamText, thinkingTrace, extractedConfig]);

  return (
    <div className="flex flex-col gap-3">
      {/* Rendered messages */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <WizardMessageBubble
            role={msg.role}
            content={msg.content}
            wizardType={msg.wizardType}
          />
        </div>
      ))}

      {/* Thinking trace (while streaming) */}
      {thinkingTrace && isStreaming && (
        <ThinkingBlock
          text={thinkingTrace}
          streaming={true}
        />
      )}

      {/* Streaming assistant text */}
      {streamText && isStreaming && (
        <div className="animate-in fade-in duration-200">
          <WizardMessageBubble
            role="assistant"
            content={streamText}
            wizardType={wizardType}
            streaming={true}
          />
        </div>
      )}

      {/* Preflight results card — shown when the LLM calls run_preflight */}
      {preflightResult && !isStreaming && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <WizardPreflightCard
            result={preflightResult}
            onInstallSkill={onInstallSkill}
            onEnableSkill={onEnableSkill}
            onSetupCredential={onSetupCredential}
            onOAuthFlow={onOAuthFlow}
            onRecheck={onRecheck}
            rechecking={rechecking}
          />
        </div>
      )}

      {/* Config preview card */}
      {extractedConfig && !isStreaming && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <WizardConfigCard
            extracted={extractedConfig}
            onConfirm={onConfirmConfig}
            onRevise={onReviseConfig}
            onCancel={onCancelWizard}
            confirming={confirming}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
});
