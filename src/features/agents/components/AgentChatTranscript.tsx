import { memo, type MutableRefObject } from "react";

import type { MessagePart } from "@/lib/chat/types";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { AgentChatView } from "./AgentChatView";
import { ChatEmptyState } from "./ChatEmptyState";

export const AgentChatTranscript = memo(function AgentChatTranscript({
  messageParts,
  streaming,
  scrollToBottomNextOutputRef,
  agentName,
  onSendStarter,
}: {
  messageParts: MessagePart[];
  streaming: boolean;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  agentName: string;
  onSendStarter: (message: string) => void;
}) {
  const {
    scrollRef,
    bottomRef,
    showJumpToLatest,
    jumpToLatest,
    scrollContainerProps,
  } = useAutoScroll({
    contentCount: messageParts.length,
    forceScrollRef: scrollToBottomNextOutputRef,
  });

  const hasMessages = messageParts.length > 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      {hasMessages ? (
        <div
          ref={scrollRef}
          data-testid="agent-chat-scroll"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          className="h-full overflow-y-auto overflow-x-hidden pt-14 pb-20 sm:pt-16 sm:pb-24 scroll-pt-14 sm:scroll-pt-16"
          {...scrollContainerProps}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 px-4 text-sm leading-relaxed text-foreground sm:px-8 md:px-12">
            <AgentChatView
              parts={messageParts}
              streaming={streaming}
            />
            <div ref={bottomRef} />
          </div>
        </div>
      ) : (
        <ChatEmptyState agentName={agentName} onSend={onSendStarter} />
      )}

      {showJumpToLatest ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center">
          <div className="h-12 w-full bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="w-full bg-background pb-3">
            <button
              type="button"
              className="pointer-events-auto mx-auto flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/70"
              onClick={jumpToLatest}
              aria-label="Jump to latest"
            >
              Jump to latest
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
