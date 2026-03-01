"use client";

import { memo, useCallback, useState } from "react";
import { FlaskConical, GitCompare, Plus, Trash2, X } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { PanelIconButton } from "@/components/PanelIconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { usePlayground } from "../hooks/usePlayground";
import { useCompare } from "../hooks/useCompare";
import { ModelSelector } from "./ModelSelector";
import { PromptEditor } from "./PromptEditor";
import { ResponseView } from "./ResponseView";
import { ComparisonView } from "./ComparisonView";
import type { PlaygroundRequest } from "../lib/types";
import { sectionLabelClass } from "@/components/SectionLabel";

interface PlaygroundPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
  models: GatewayModelChoice[];
  /** Default model key (provider/id) to pre-select */
  defaultModel?: string;
  isTabActive?: boolean;
}

const MAX_COMPARE_MODELS = 3;

export const PlaygroundPanel = memo(function PlaygroundPanel({
  client,
  status,
  agentId,
  models,
  defaultModel,
}: PlaygroundPanelProps) {
  const isConnected = status === "connected";

  // ── Mode ────────────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);

  // ── Form state (shared across modes) ────────────────────────────────
  const firstModel =
    defaultModel ??
    (models.length > 0 ? `${models[0].provider}/${models[0].id}` : "");
  const secondModel =
    models.length > 1
      ? `${models[1].provider}/${models[1].id}`
      : firstModel;

  const [selectedModel, setSelectedModel] = useState<string>(firstModel);
  const [compareModels, setCompareModels] = useState<string[]>([
    firstModel,
    secondModel,
  ]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMessage, setUserMessage] = useState("");

  // ── Playground hook (single mode) ───────────────────────────────────
  const {
    results,
    streamText,
    isStreaming,
    error,
    run,
    abort,
    clearResults,
  } = usePlayground({ client, agentId });

  // ── Compare hook ─────────────────────────────────────────────────────
  const {
    currentRun,
    isAnyStreaming,
    error: compareError,
    run: runCompare,
    abort: abortCompare,
    clear: clearCompare,
  } = useCompare({ client, agentId });

  const latestResult = results[0] ?? null;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (compareMode) {
      if (isAnyStreaming || !userMessage.trim()) return;
      void runCompare(compareModels, systemPrompt, userMessage.trim());
    } else {
      if (!selectedModel || !userMessage.trim() || isStreaming) return;
      const req: PlaygroundRequest = {
        model: selectedModel,
        systemPrompt,
        userMessage: userMessage.trim(),
      };
      void run(req);
    }
  }, [
    compareMode,
    isAnyStreaming,
    isStreaming,
    userMessage,
    systemPrompt,
    selectedModel,
    compareModels,
    run,
    runCompare,
  ]);

  const handleAbort = useCallback(() => {
    if (compareMode) void abortCompare();
    else void abort();
  }, [compareMode, abort, abortCompare]);

  const handleClear = useCallback(() => {
    if (compareMode) clearCompare();
    else clearResults();
  }, [compareMode, clearCompare, clearResults]);

  const handleModeToggle = useCallback(() => {
    setCompareMode((prev) => !prev);
  }, []);

  const handleCompareModelChange = useCallback(
    (idx: number, value: string) => {
      setCompareModels((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    []
  );

  const handleAddCompareModel = useCallback(() => {
    setCompareModels((prev) => {
      if (prev.length >= MAX_COMPARE_MODELS) return prev;
      const usedSet = new Set(prev);
      const nextModel = models.find(
        (m) => !usedSet.has(`${m.provider}/${m.id}`)
      );
      const key = nextModel
        ? `${nextModel.provider}/${nextModel.id}`
        : (prev[0] ?? "");
      return [...prev, key];
    });
  }, [models]);

  const handleRemoveCompareModel = useCallback((idx: number) => {
    setCompareModels((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const notConnected = !isConnected;
  const activeStreaming = compareMode ? isAnyStreaming : isStreaming;
  const hasResults = compareMode ? !!currentRun : results.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <PanelHeader
        icon={<FlaskConical className="h-4 w-4" />}
        title="Playground"
        actions={
          <div className="flex items-center gap-1">
            <PanelIconButton
              onClick={handleModeToggle}
              aria-label={
                compareMode
                  ? "Switch to single model"
                  : "Compare models side-by-side"
              }
              title={
                compareMode
                  ? "Single model mode"
                  : "Compare mode — run same prompt on multiple models"
              }
              className={compareMode ? "text-primary" : undefined}
            >
              <GitCompare className="h-3.5 w-3.5" />
            </PanelIconButton>
            {hasResults && (
              <PanelIconButton
                onClick={handleClear}
                aria-label="Clear results"
                title="Clear results"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </PanelIconButton>
            )}
          </div>
        }
      />

      {notConnected && (
        <div className="px-3">
          <ErrorBanner message="Gateway disconnected — reconnect to use the playground." />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Input pane */}
        <div className="flex flex-col gap-0 overflow-y-auto border-b border-border/50">
          <div className="px-3 pt-3 pb-1">
            {compareMode ? (
              <CompareModelSelectors
                models={models}
                compareModels={compareModels}
                onModelChange={handleCompareModelChange}
                onAddModel={handleAddCompareModel}
                onRemoveModel={handleRemoveCompareModel}
                disabled={activeStreaming || notConnected}
              />
            ) : (
              <ModelSelector
                models={models}
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={isStreaming || notConnected}
              />
            )}
          </div>

          <PromptEditor
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            userMessage={userMessage}
            onUserMessageChange={setUserMessage}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            isStreaming={activeStreaming}
            disabled={notConnected || (!compareMode && !selectedModel)}
          />
        </div>

        {/* Output pane */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {compareMode ? (
            <>
              {compareError && !currentRun && (
                <div className="px-3 pt-3">
                  <ErrorBanner message={compareError} />
                </div>
              )}
              <ComparisonView run={currentRun} isAnyStreaming={isAnyStreaming} />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ── CompareModelSelectors ────────────────────────────────────────────────────

interface CompareModelSelectorsProps {
  models: GatewayModelChoice[];
  compareModels: string[];
  onModelChange: (idx: number, value: string) => void;
  onAddModel: () => void;
  onRemoveModel: (idx: number) => void;
  disabled: boolean;
}

const CompareModelSelectors = memo(function CompareModelSelectors({
  models,
  compareModels,
  onModelChange,
  onAddModel,
  onRemoveModel,
  disabled,
}: CompareModelSelectorsProps) {
  const canAdd = compareModels.length < MAX_COMPARE_MODELS;
  const canRemove = compareModels.length > 2;

  const providers = Array.from(new Set(models.map((m) => m.provider))).sort();
  const byProvider = providers.map((p) => ({
    provider: p,
    models: models.filter((m) => m.provider === p),
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`${sectionLabelClass} text-muted-foreground`}>
          Compare models ({compareModels.length})
        </span>
        {canAdd && (
          <button
            type="button"
            onClick={onAddModel}
            disabled={disabled}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground
              transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-2.5 w-2.5" />
            Add model
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {compareModels.map((model, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <select
                value={model}
                onChange={(e) => onModelChange(idx, e.target.value)}
                disabled={disabled || models.length === 0}
                className="w-full appearance-none rounded-lg border border-border bg-background px-2.5 py-1.5 pr-6 text-xs
                  text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                {models.length === 0 && (
                  <option value="">No models available</option>
                )}
                {byProvider.map(({ provider, models: pm }) => (
                  <optgroup key={provider} label={provider}>
                    {pm.map((m) => {
                      const key = `${m.provider}/${m.id}`;
                      const ctx = m.contextWindow
                        ? ` (${(m.contextWindow / 1000).toFixed(0)}K)`
                        : "";
                      return (
                        <option key={key} value={key}>
                          {m.name || m.id}{ctx}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemoveModel(idx)}
                disabled={disabled}
                aria-label={`Remove model ${idx + 1}`}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border
                  text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
