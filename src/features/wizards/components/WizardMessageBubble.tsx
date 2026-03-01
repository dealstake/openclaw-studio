import { memo } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageActions } from "@/features/agents/components/MessageActions";
import { getWizardTheme } from "../lib/wizardThemes";
import type { WizardType } from "../lib/wizardTypes";

type WizardMessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  wizardType: WizardType;
  streaming?: boolean;
};

/**
 * A chat bubble with themed left-border accent for wizard messages.
 * Wraps the standard MessageBubble with wizard-specific visual treatment.
 */
export const WizardMessageBubble = memo(function WizardMessageBubble({
  role,
  content,
  wizardType,
  streaming = false,
}: WizardMessageBubbleProps) {
  const theme = getWizardTheme(wizardType);

  return (
    <div className={`border-l-2 pl-3 ${theme.border}`}>
      <MessageBubble
        role={role}
        content={content}
        streaming={streaming}
        actions={role === "assistant" ? <MessageActions text={content} /> : undefined}
      />
    </div>
  );
});
