"use client";

import { memo, useCallback, useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { PanelIconButton } from "@/components/PanelIconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { usePlayground } from "../hooks/usePlayground";
import { ModelSelector } from "./ModelSelector";
import { PromptEditor } from "./PromptEditor";
import { ResponseView } from "./ResponseView";
import type { PlaygroundRequest } from "../lib/types";

interface PlaygroundPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
  models: GatewayModelChoice[];
  /** Default model key (provider/id) to pre-select */
  defaultModel?: string;
  isTabActive?: boolean;
}

export const PlaygroundPanel = memo(function PlaygroundPanel({
  client,
  status,
  agentId,
  models,
  defaultModel,
}: PlaygroundPanelProps) {
  const isConnected = status === "connected";

  // ── Form state ──────────────────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState<string>(
    defaultModel ?? (models.length > 0 ? `${models[0].provider}/${models[0].id}` : "")
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMessage, setUserMessage] = useState("");

  // ── Playground hook ─────────────────────────────────────────────────
  const {
    results,
    streamText,
    isStreaming,
    error,
    run,
    abort,
    clearResults,
  } = usePlayground({ client, agentId });

  const latestResult = results[0] ?? null;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!selectedModel || !userMessage.trim() || isStreaming) return;
    const req: PlaygroundRequest = {
      model: selectedModel,
      systemPrompt,
      userMessage: userMessage.trim(),
    };
    void run(req);
  }, [selectedModel, systemPrompt, userMessage, isStreaming, run]);

  const handleAbort = useCallback(() => {
    void abort();
  }, [abort]);

  const notConnected = !isConnected;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <PanelHeader
        icon={<FlaskConical className="h-4 w-4" />}
        title="Playground"
        actions={
          results.length > 0 ? (
            <PanelIconButton
              onClick={clearResults}
              aria-label="Clear results"
              title="Clear results"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PanelIconButton>
          ) : undefined
        }
      />

      {notConnected && (
        <div className="px-3">
          <ErrorBanner message="Gateway disconnected — reconnect to use the playground." />
        </div>
      )}

      {/* Split layout: input on top, output below */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Input pane — fixed height, scrollable */}
        <div className="flex flex-col gap-0 overflow-y-auto border-b border-border/50">
          {/* Model selector */}
          <div className="px-3 pt-3 pb-1">
            <ModelSelector
              models={models}
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isStreaming || notConnected}
            />
          </div>

          {/* Prompts */}
          <PromptEditor
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            userMessage={userMessage}
            onUserMessageChange={setUserMessage}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            isStreaming={isStreaming}
            disabled={notConnected || !selectedModel}
          />
        </div>

        {/* Output pane — fills remaining height */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {error && !latestResult && (
            <div className="px-3 pt-3">
              <ErrorBanner message={error} />
            </div>
          )}
          <ResponseView
            result={latestResult}
            streamText={streamText}
            isStreaming={isStreaming}
            error={latestResult?.error ?? error}
          />
        </div>
      </div>
    </div>
  );
});
