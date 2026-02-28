"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { SkillsReport, SkillStatusFilter } from "../lib/types";
import {
  fetchSkillsStatus,
  toggleSkill,
  saveSkillApiKey,
} from "../lib/skillService";

export function useSkills(client: GatewayClient, status: GatewayStatus) {
  const [report, setReport] = useState<SkillsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<SkillStatusFilter>("all");
  const [search, setSearch] = useState("");

  // Stable ref for load to avoid useEffect cascades
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSkillsStatus(client);
      setReport(result);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        setError(
          err instanceof Error ? err.message : "Failed to load skills.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
  }, [status]);

  const handleToggle = useCallback(
    async (key: string, enabled: boolean) => {
      setBusyKey(key);
      try {
        await toggleSkill(client, key, enabled);
        await loadRef.current();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update skill.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [client],
  );

  const handleSaveApiKey = useCallback(
    async (key: string, apiKey: string) => {
      setBusyKey(key);
      try {
        await saveSkillApiKey(client, key, apiKey);
        await loadRef.current();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save API key.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [client],
  );

  // Filtered skills — memoized to avoid recalculation on unrelated state changes
  const filteredSkills = useMemo(
    () =>
      report?.skills.filter((s) => {
        // Status filter
        if (filter === "ready" && (s.blocked || !s.enabled)) return false;
        if (filter === "blocked" && !s.blocked) return false;
        if (filter === "disabled" && s.enabled) return false;
        // Search filter
        if (search) {
          const q = search.toLowerCase();
          if (
            !s.name.toLowerCase().includes(q) &&
            !s.description.toLowerCase().includes(q) &&
            !s.key.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }) ?? [],
    [report, filter, search],
  );

  return {
    report,
    skills: filteredSkills,
    loading,
    error,
    busyKey,
    filter,
    search,
    setFilter,
    setSearch,
    reload: load,
    onToggle: handleToggle,
    onSaveApiKey: handleSaveApiKey,
  };
}
