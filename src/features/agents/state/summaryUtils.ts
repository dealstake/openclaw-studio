import type { AgentState } from "./store";
import type {
  ChatEventPayload,
  AgentEventPayload,
  SummarySnapshotAgent,
  SummaryStatusSnapshot,
  SummaryPreviewSnapshot,
  SummaryPreviewEntry,
  SummarySessionStatusEntry,
  SummarySnapshotPatch,
} from "./runtimeEventBridge.types";
import {
  extractText,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";

const toTimestampMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export const buildSummarySnapshotPatches = ({
  agents,
  statusSummary,
  previewResult,
}: {
  agents: SummarySnapshotAgent[];
  statusSummary: SummaryStatusSnapshot;
  previewResult: SummaryPreviewSnapshot;
}): SummarySnapshotPatch[] => {
  const previewMap = new Map<string, SummaryPreviewEntry>();
  for (const entry of previewResult.previews ?? []) {
    previewMap.set(entry.key, entry);
  }
  const activityByKey = new Map<string, number>();
  const addActivity = (entries?: SummarySessionStatusEntry[]) => {
    if (!entries) return;
    for (const entry of entries) {
      if (!entry?.key || typeof entry.updatedAt !== "number") continue;
      activityByKey.set(entry.key, entry.updatedAt);
    }
  };
  addActivity(statusSummary.sessions?.recent);
  for (const group of statusSummary.sessions?.byAgent ?? []) {
    addActivity(group.recent);
  }
  const patches: SummarySnapshotPatch[] = [];
  for (const agent of agents) {
    const patch: Partial<AgentState> = {};
    const activity = activityByKey.get(agent.sessionKey);
    if (typeof activity === "number") {
      patch.lastActivityAt = activity;
    }
    const preview = previewMap.get(agent.sessionKey);
    if (preview?.items?.length) {
      const latestItem = preview.items[preview.items.length - 1];
      if (latestItem?.role === "assistant" && agent.status !== "running") {
        const previewTs = toTimestampMs(latestItem.timestamp);
        if (typeof previewTs === "number") {
          patch.lastAssistantMessageAt = previewTs;
        } else if (typeof activity === "number") {
          patch.lastAssistantMessageAt = activity;
        }
      }
      const lastAssistant = [...preview.items]
        .reverse()
        .find((item) => item.role === "assistant");
      const lastUser = [...preview.items].reverse().find((item) => item.role === "user");
      if (lastAssistant?.text) {
        patch.latestPreview = stripUiMetadata(lastAssistant.text);
      }
      if (lastUser?.text) {
        patch.lastUserMessage = stripUiMetadata(lastUser.text);
      }
    }
    if (Object.keys(patch).length > 0) {
      patches.push({ agentId: agent.agentId, patch });
    }
  }
  return patches;
};

export const getChatSummaryPatch = (
  payload: ChatEventPayload,
  now: number = Date.now()
): Partial<AgentState> | null => {
  const message = payload.message;
  const role =
    message && typeof message === "object"
      ? (message as Record<string, unknown>).role
      : null;
  const rawText = extractText(message);
  if (typeof rawText === "string" && isUiMetadataPrefix(rawText.trim())) {
    return { lastActivityAt: now };
  }
  const cleaned = typeof rawText === "string" ? stripUiMetadata(rawText) : null;
  const patch: Partial<AgentState> = { lastActivityAt: now };
  if (role === "user") {
    if (cleaned) {
      patch.lastUserMessage = cleaned;
    }
    return patch;
  }
  if (role === "assistant") {
    if (cleaned) {
      patch.latestPreview = cleaned;
    }
    return patch;
  }
  if (payload.state === "error" && payload.errorMessage) {
    patch.latestPreview = payload.errorMessage;
  }
  return patch;
};

export const getAgentSummaryPatch = (
  payload: AgentEventPayload,
  now: number = Date.now()
): Partial<AgentState> | null => {
  if (payload.stream !== "lifecycle") return null;
  const phase = typeof payload.data?.phase === "string" ? payload.data.phase : "";
  if (!phase) return null;
  const patch: Partial<AgentState> = { lastActivityAt: now };
  if (phase === "start") {
    patch.status = "running";
    return patch;
  }
  if (phase === "end") {
    patch.status = "idle";
    return patch;
  }
  if (phase === "error") {
    patch.status = "error";
    return patch;
  }
  return patch;
};
