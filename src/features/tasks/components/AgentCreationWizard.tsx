"use client";

import { memo, useCallback, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { createGatewayAgent } from "@/lib/gateway/agentConfig";

// ─── Props ───────────────────────────────────────────────────────────────────

interface AgentCreationWizardProps {
  client: GatewayClient;
  onCreated: (agentId: string) => void;
  onCancel: () => void;
}

type CreationStep = "form" | "creating" | "success" | "error";

// ─── Component ───────────────────────────────────────────────────────────────

export const AgentCreationWizard = memo(function AgentCreationWizard({
  client,
  onCreated,
  onCancel,
}: AgentCreationWizardProps) {
  const [step, setStep] = useState<CreationStep>("form");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !purpose.trim()) return;

    setStep("creating");
    setError(null);

    try {
      // 1. Create agent in gateway config (generates ID, patches config, restarts)
      const entry = await createGatewayAgent({
        client,
        name: name.trim(),
      });

      // 2. Create brain files on disk
      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: entry.id,
          name: name.trim(),
          purpose: purpose.trim(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to create agent files.");
      }

      setCreatedAgentId(entry.id);
      setStep("success");

      // Auto-continue after a short pause
      setTimeout(() => {
        onCreated(entry.id);
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Agent creation failed.";
      setError(message);
      setStep("error");
    }
  }, [client, name, purpose, onCreated]);

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Create New Agent
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Set up a new AI agent to handle this task
          </p>
        </div>
      </div>

      {step === "form" && (
        <>
          {/* Name input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="agent-name"
              className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Agent Name
            </label>
            <input
              id="agent-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Email Monitor, Deal Tracker"
              className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Purpose input */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="agent-purpose"
              className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              What will this agent do?
            </label>
            <textarea
              id="agent-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the agent's primary purpose and responsibilities…"
              className="min-h-[80px] resize-none rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              rows={3}
            />
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The agent will be created with default brain files (SOUL.md,
              AGENTS.md, HEARTBEAT.md, MEMORY.md) customized for its purpose.
              You can fine-tune them later.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCreate}
              disabled={!name.trim() || !purpose.trim()}
            >
              <Bot className="h-3.5 w-3.5" />
              Create Agent
            </button>
            <button
              type="button"
              className="flex h-9 items-center rounded-lg border border-border/80 bg-card/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/65"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {step === "creating" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          <p className="text-sm text-muted-foreground">
            Creating agent and generating brain files…
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              Agent Created!
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono text-primary">
                {createdAgentId}
              </span>{" "}
              is ready. Returning to task wizard…
            </p>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-3 py-4">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-8 items-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
              onClick={() => setStep("form")}
            >
              Try Again
            </button>
            <button
              type="button"
              className="flex h-8 items-center rounded-lg border border-border/80 bg-card/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/65"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
