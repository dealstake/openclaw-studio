import { useCallback, useRef, useState } from "react";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

/**
 * Generic hook for resource-panel CRUD patterns (load, run, delete, toggle)
 * shared by cron jobs and heartbeats panels.
 *
 * @template T - The resource item type (must have a string `id`).
 */

type ResourceWithId = { id: string };

export type UseResourcePanelConfig<T extends ResourceWithId> = {
  /** Fetch items for a given agentId. */
  fetchItems: (agentId: string) => Promise<T[]>;
  /** Execute the "run" action for an item. */
  runItem?: (agentId: string, itemId: string) => Promise<void>;
  /** Execute the "delete" action for an item. Returns true if removed. */
  deleteItem?: (agentId: string, itemId: string) => Promise<boolean>;
  /** Execute the "toggle" action for an item. */
  toggleItem?: (agentId: string, itemId: string, enabled: boolean) => Promise<void>;
  /** Label for error messages (e.g. "cron jobs", "heartbeats"). */
  resourceLabel: string;
};

export function useResourcePanel<T extends ResourceWithId>(
  config: UseResourcePanelConfig<T>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runBusyId, setRunBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const load = useCallback(async (agentId: string) => {
    const resolved = agentId.trim();
    if (!resolved) {
      setItems([]);
      setError(`Failed to load ${configRef.current.resourceLabel}: missing agent id.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await configRef.current.fetchItems(resolved);
      setItems(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Failed to load ${configRef.current.resourceLabel}.`;
      setItems([]);
      setError(message);
      if (!isGatewayDisconnectLikeError(err)) {
        console.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  const handleRun = useCallback(
    async (agentId: string, itemId: string) => {
      const resolvedId = itemId.trim();
      const resolvedAgent = agentId.trim();
      if (!resolvedId || !resolvedAgent) return;
      if (runBusyId || deleteBusyId) return;
      if (!configRef.current.runItem) return;
      setRunBusyId(resolvedId);
      setError(null);
      try {
        await configRef.current.runItem(resolvedAgent, resolvedId);
        await load(resolvedAgent);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to run ${configRef.current.resourceLabel.replace(/s$/, "")}.`;
        setError(message);
        console.error(message);
      } finally {
        setRunBusyId((current) => (current === resolvedId ? null : current));
      }
    },
    [deleteBusyId, load, runBusyId],
  );

  const handleDelete = useCallback(
    async (agentId: string, itemId: string) => {
      const resolvedId = itemId.trim();
      const resolvedAgent = agentId.trim();
      if (!resolvedId || !resolvedAgent) return;
      if (runBusyId || deleteBusyId) return;
      if (!configRef.current.deleteItem) return;
      setDeleteBusyId(resolvedId);
      setError(null);
      try {
        const removed = await configRef.current.deleteItem(resolvedAgent, resolvedId);
        if (removed) {
          setItems((prev) => prev.filter((item) => item.id !== resolvedId));
        }
        await load(resolvedAgent);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to delete ${configRef.current.resourceLabel.replace(/s$/, "")}.`;
        setError(message);
        console.error(message);
      } finally {
        setDeleteBusyId((current) => (current === resolvedId ? null : current));
      }
    },
    [deleteBusyId, load, runBusyId],
  );

  const handleToggle = useCallback(
    async (agentId: string, itemId: string, enabled: boolean) => {
      const resolvedId = itemId.trim();
      const resolvedAgent = agentId.trim();
      if (!resolvedId || !resolvedAgent) return;
      if (toggleBusyId) return;
      if (!configRef.current.toggleItem) return;
      setToggleBusyId(resolvedId);
      setError(null);
      try {
        await configRef.current.toggleItem(resolvedAgent, resolvedId, enabled);
        await load(resolvedAgent);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Failed to toggle ${configRef.current.resourceLabel.replace(/s$/, "")}.`;
        setError(message);
        console.error(message);
      } finally {
        setToggleBusyId((current) => (current === resolvedId ? null : current));
      }
    },
    [load, toggleBusyId],
  );

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setError(null);
    setRunBusyId(null);
    setDeleteBusyId(null);
    setToggleBusyId(null);
  }, []);

  return {
    items,
    loading,
    error,
    runBusyId,
    deleteBusyId,
    toggleBusyId,
    load,
    loadRef,
    handleRun,
    handleDelete,
    handleToggle,
    reset,
  };
}
