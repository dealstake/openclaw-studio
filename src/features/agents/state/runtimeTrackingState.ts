import type { MessagePart } from "@/lib/chat/types";
import type { GatewayRuntimeEventHandlerDeps } from "./gatewayRuntimeEventHandler.types";

/**
 * Shared mutable tracking state for the runtime event handler.
 * Extracted from the monolithic closure to allow chat and agent event
 * handlers to operate independently while sharing run-level state.
 */
export class RuntimeTrackingState {
  readonly chatRunSeen = new Set<string>();
  readonly assistantStreamByRun = new Map<string, string>();
  readonly thinkingStreamByRun = new Map<string, string>();
  readonly thinkingDebugBySession = new Set<string>();
  readonly lastActivityMarkByAgent = new Map<string, number>();
  /** Key: "{agentId}:{runId}:{partType}" or "{agentId}:{runId}:tool:{toolCallId}" */
  readonly partIndexByKey = new Map<string, number>();

  private readonly _now: () => number;
  private readonly _deps: GatewayRuntimeEventHandlerDeps;

  constructor(deps: GatewayRuntimeEventHandlerDeps) {
    this._deps = deps;
    this._now = deps.now ?? (() => Date.now());
  }

  now(): number {
    return this._now();
  }

  get deps(): GatewayRuntimeEventHandlerDeps {
    return this._deps;
  }

  getPartKey(agentId: string, runId: string, suffix: string): string {
    return `${agentId}:${runId}:${suffix}`;
  }

  appendOrUpdatePart(agentId: string, key: string, part: MessagePart): void {
    const existingIndex = this.partIndexByKey.get(key);
    if (existingIndex !== undefined) {
      this._deps.dispatch({ type: "updatePart", agentId, index: existingIndex, patch: part });
    } else {
      const agent = this._deps.getAgents().find((a) => a.agentId === agentId);
      const nextIndex = agent ? agent.messageParts.length : 0;
      this.partIndexByKey.set(key, nextIndex);
      this._deps.dispatch({ type: "appendPart", agentId, part });
    }
  }

  clearRunTracking(runId?: string | null): void {
    if (!runId) return;
    this.chatRunSeen.delete(runId);
    this.assistantStreamByRun.delete(runId);
    this.thinkingStreamByRun.delete(runId);
    for (const key of this.partIndexByKey.keys()) {
      if (key.includes(`:${runId}:`)) {
        this.partIndexByKey.delete(key);
      }
    }
  }

  markActivityThrottled(agentId: string, at: number = this.now()): void {
    const lastAt = this.lastActivityMarkByAgent.get(agentId) ?? 0;
    if (at - lastAt < 300) return;
    this.lastActivityMarkByAgent.set(agentId, at);
    this._deps.dispatch({ type: "markActivity", agentId, at });
  }

  logWarn(message: string, meta?: unknown): void {
    if (this._deps.logWarn) {
      this._deps.logWarn(message, meta);
    } else {
      console.warn(message, meta);
    }
  }

  dispose(): void {
    this.chatRunSeen.clear();
    this.assistantStreamByRun.clear();
    this.thinkingStreamByRun.clear();
    this.thinkingDebugBySession.clear();
    this.lastActivityMarkByAgent.clear();
    this.partIndexByKey.clear();
  }
}
