"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { WizardChat } from "@/components/chat/WizardChat";
import { createConfigExtractor } from "@/components/chat/wizardConfigExtractor";
import {
  buildAgentWizardPrompt,
  getAgentWizardStarters,
} from "@/features/agents/lib/agentWizardPrompt";
import { AgentPreviewCard } from "@/features/agents/components/AgentPreviewCard";
import {
  extractBrainFiles,
  isAgentConfig,
  type AgentConfig,
} from "@/features/agents/lib/agentConfigUtils";
import { createGatewayAgent } from "@/lib/gateway/agentConfig";
import { SectionLabel } from "@/components/SectionLabel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// ── Types ──────────────────────────────────────────────────────────────

interface AgentWizardModalProps {
  open: boolean;
  client: GatewayClient;
  onCreated: (agentId: string) => void;
  onClose: () => void;
}

type ModalStep = "chat" | "preview";

// ── Component ──────────────────────────────────────────────────────────

export const AgentWizardModal = React.memo(function AgentWizardModal({
  open,
  client,
  onCreated,
  onClose,
}: AgentWizardModalProps) {
  const [step, setStep] = useState<ModalStep>("chat");
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [brainFiles, setBrainFiles] = useState<Record<string, string>>({});
  const [existingAgents, setExistingAgents] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mount animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [open]);

  // Fetch existing agents on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const result: unknown = await client.call("agents.list", {});
        if (
          !cancelled &&
          result != null &&
          typeof result === "object" &&
          "agents" in result &&
          Array.isArray((result as Record<string, unknown>).agents)
        ) {
          const agents = (result as Record<string, unknown>).agents as unknown[];
          setExistingAgents(
            agents
              .filter(
                (a): a is { id: string; name?: string } =>
                  a != null &&
                  typeof a === "object" &&
                  "id" in a &&
                  typeof (a as Record<string, unknown>).id === "string",
              )
              .map((a) => ({ id: a.id, name: a.name ?? a.id })),
          );
        }
      } catch {
        // Non-critical — wizard works without existing agent list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, client]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const agentConfigExtractor = useMemo(
    () => createConfigExtractor("agent"),
    [],
  );

  const systemPrompt = useMemo(
    () => buildAgentWizardPrompt(existingAgents),
    [existingAgents],
  );

  const starters = useMemo(() => getAgentWizardStarters(), []);

  const handleConfigExtracted = useCallback(
    (config: unknown) => {
      if (isAgentConfig(config)) {
        setAgentConfig(config);
        // Extract brain files from the last assistant message
        // The config extractor fires with the full text, which we need to capture
        // We'll rely on the WizardChat's internal message state
        // For now, we parse brain files from the same text that triggered extraction
      }
    },
    [],
  );

  // We need a custom config extractor that also captures the full text
  const wrappedExtractor = useCallback(
    (text: string): unknown | null => {
      const config = agentConfigExtractor(text);
      if (config && isAgentConfig(config)) {
        setAgentConfig(config);
        setBrainFiles(extractBrainFiles(text));
        // Show preview after a brief delay to let the message render
        setTimeout(() => setStep("preview"), 300);
      }
      return config;
    },
    [agentConfigExtractor],
  );

  const handleConfirm = useCallback(async () => {
    if (!agentConfig || creating) return;
    setCreating(true);
    setError(null);

    try {
      // Step 1: Create agent in gateway config
      await createGatewayAgent({ client, name: agentConfig.name });

      // Step 2: Write brain files via API route
      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agentConfig.agentId,
          name: agentConfig.name,
          purpose: agentConfig.purpose,
          brainFiles: Object.keys(brainFiles).length > 0 ? brainFiles : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create agent files");
      }

      onCreated(agentConfig.agentId);
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }, [agentConfig, brainFiles, client, creating, onCreated]);

  const handleRevise = useCallback(() => {
    setStep("chat");
    setAgentConfig(null);
    setBrainFiles({});
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose]);

  function resetState() {
    setStep("chat");
    setAgentConfig(null);
    setBrainFiles({});
    setError(null);
    setCreating(false);
  }

  if (!open) return null;

  return (
    <div
      data-state={visible ? "open" : "closed"}
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-background/70 backdrop-blur-sm transition-opacity duration-300 ease-out data-[state=closed]:opacity-0 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Creation Wizard"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        data-state={visible ? "open" : "closed"}
        className="flex h-full w-full flex-col overflow-hidden bg-card shadow-lg transition-all duration-300 ease-out data-[state=closed]:translate-y-full data-[state=closed]:opacity-0 sm:data-[state=closed]:scale-95 sm:data-[state=closed]:translate-y-0 sm:h-[min(85vh,680px)] sm:max-w-lg sm:rounded-lg sm:border sm:border-border"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {step === "preview" && (
              <button
                type="button"
                className="flex h-7 w-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                onClick={handleRevise}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary-text" />
              <SectionLabel as="span">
                {step === "chat" ? "Agent Wizard" : "Review Agent"}
              </SectionLabel>
            </div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
            onClick={handleClose}
            aria-label="Close wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="shrink-0 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {step === "chat" && (
            <WizardChat
              client={client}
              agentId={existingAgents[0]?.id ?? "main"}
              wizardType="agent"
              systemPrompt={systemPrompt}
              starters={starters}
              configExtractor={wrappedExtractor}
              onConfigExtracted={handleConfigExtracted}
            />
          )}
          {step === "preview" && agentConfig && (
            <div className="h-full overflow-y-auto p-4">
              <AgentPreviewCard
                config={agentConfig}
                brainFiles={brainFiles}
                onConfirm={handleConfirm}
                onRevise={handleRevise}
                className={creating ? "pointer-events-none opacity-60" : ""}
              />
              {creating && (
                <p className="mt-3 text-center text-xs text-muted-foreground animate-pulse">
                  Creating agent…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
