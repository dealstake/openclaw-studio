import { useCallback, useEffect, useState } from "react";
import type { ConfigMutationKind, QueuedConfigMutation } from "../types";

export function useConfigMutationQueue(params: {
  hasRunningAgents: boolean;
  deleteAgentBlockPhase: string | null;
  createAgentBlockPhase: string | null;
  renameAgentBlockPhase: string | null;
  status: string;
}) {
  const {
    hasRunningAgents,
    deleteAgentBlockPhase,
    createAgentBlockPhase,
    renameAgentBlockPhase,
    status,
  } = params;

  const [queuedConfigMutations, setQueuedConfigMutations] = useState<QueuedConfigMutation[]>([]);
  const [activeConfigMutation, setActiveConfigMutation] = useState<QueuedConfigMutation | null>(
    null
  );

  const enqueueConfigMutation = useCallback(
    (params: {
      kind: ConfigMutationKind;
      label: string;
      run: () => Promise<void>;
    }) =>
      new Promise<void>((resolve, reject) => {
        const queued: QueuedConfigMutation = {
          id: crypto.randomUUID(),
          kind: params.kind,
          label: params.label,
          run: params.run,
          resolve,
          reject,
        };
        setQueuedConfigMutations((current) => [...current, queued]);
      }),
    []
  );

  // Dequeue when ready
  useEffect(() => {
    if (status !== "connected") return;
    if (activeConfigMutation) return;
    if (deleteAgentBlockPhase && deleteAgentBlockPhase !== "queued") return;
    if (createAgentBlockPhase && createAgentBlockPhase !== "queued") return;
    if (renameAgentBlockPhase && renameAgentBlockPhase !== "queued") return;
    if (hasRunningAgents) return;
    const next = queuedConfigMutations[0];
    if (!next) return;
    setQueuedConfigMutations((current) => current.slice(1));
    setActiveConfigMutation(next);
  }, [
    activeConfigMutation,
    createAgentBlockPhase,
    deleteAgentBlockPhase,
    renameAgentBlockPhase,
    hasRunningAgents,
    queuedConfigMutations,
    status,
  ]);

  // Run active mutation
  useEffect(() => {
    if (!activeConfigMutation) return;
    let mounted = true;
    const run = async () => {
      try {
        await activeConfigMutation.run();
        activeConfigMutation.resolve();
      } catch (error) {
        activeConfigMutation.reject(error);
      } finally {
        if (mounted) {
          setActiveConfigMutation(null);
        }
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [activeConfigMutation]);

  return {
    queuedConfigMutations,
    activeConfigMutation,
    enqueueConfigMutation,
    queuedConfigMutationCount: queuedConfigMutations.length,
  };
}
