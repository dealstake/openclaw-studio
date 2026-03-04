"use client";

/**
 * useContacts — data hook for the Contacts CRM feature.
 *
 * Fetches, searches, and mutates contacts and interaction history via the
 * /api/workspace/contacts and /api/workspace/contact routes.
 */

import { useCallback, useRef, useState } from "react";

// ─── Client-side types (mirrors DB schema; no server imports) ─────────────────

/** Parse JSON-encoded tags string into a string array, safely. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type ClientContactRow = {
  id: string;
  agentId: string;
  personaId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  /** JSON-encoded string array e.g. '["prospect","cto"]' */
  tags: string | null;
  stage: string | null;
  notes: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ClientInteractionRow = {
  id: string;
  contactId: string;
  agentId: string;
  personaId: string;
  type: string;
  channel: string | null;
  summary: string | null;
  content: string | null;
  outcome: string | null;
  artifactLink: string | null;
  createdAt: string;
};

export type ClientContactDetail = ClientContactRow & {
  recentInteractions: ClientInteractionRow[];
};

export interface ContactFilters {
  personaId?: string;
  stage?: string;
  tag?: string;
  /** Full-text search query */
  q?: string;
}

export interface ContactUpsertInput {
  id?: string;
  personaId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  tags?: string | string[] | null;
  stage?: string | null;
  notes?: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface ContactsListState {
  contacts: ClientContactRow[];
  total: number;
  loading: boolean;
  error: string | null;
}

interface ContactDetailState {
  contact: ClientContactDetail | null;
  loading: boolean;
  error: string | null;
}

export function useContacts(agentId: string | null) {
  const [listState, setListState] = useState<ContactsListState>({
    contacts: [],
    total: 0,
    loading: false,
    error: null,
  });

  const [detailState, setDetailState] = useState<ContactDetailState>({
    contact: null,
    loading: false,
    error: null,
  });

  const lastFiltersRef = useRef<ContactFilters>({});
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  // ── Load list ──────────────────────────────────────────────────────────────

  const loadContacts = useCallback(
    async (filters: ContactFilters = {}, limit = 50, offset = 0) => {
      if (!agentId) return;
      // Abort any in-flight list fetch to prevent race conditions from rapid searches
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;
      lastFiltersRef.current = filters;
      setListState((s) => ({ ...s, loading: true, error: null }));

      try {

        const params = new URLSearchParams({
          agentId,
          limit: String(limit),
          offset: String(offset),
        });
        if (filters.personaId) params.set("personaId", filters.personaId);
        if (filters.stage) params.set("stage", filters.stage);
        if (filters.tag) params.set("tag", filters.tag);
        if (filters.q?.trim()) params.set("q", filters.q.trim());

        const res = await fetch(`/api/workspace/contacts?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { contacts: ClientContactRow[]; total: number };

        setListState({ contacts: data.contacts, total: data.total, loading: false, error: null });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : String(err);
        setListState((s) => ({ ...s, loading: false, error: msg }));
      }
    },
    [agentId],
  );

  // ── Load detail ────────────────────────────────────────────────────────────

  const loadContactDetail = useCallback(
    async (id: string) => {
      if (!agentId) return;
      setDetailState({ contact: null, loading: true, error: null });

      try {
        // Abort any in-flight detail fetch to prevent race conditions
        detailAbortRef.current?.abort();
        const controller = new AbortController();
        detailAbortRef.current = controller;

        const params = new URLSearchParams({ agentId, id });
        const res = await fetch(`/api/workspace/contact?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { contact: ClientContactDetail };
        setDetailState({ contact: data.contact, loading: false, error: null });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : String(err);
        setDetailState({ contact: null, loading: false, error: msg });
      }
    },
    [agentId],
  );

  const clearDetail = useCallback(() => {
    setDetailState({ contact: null, loading: false, error: null });
  }, []);

  // ── Upsert contact ─────────────────────────────────────────────────────────

  const upsertContact = useCallback(
    async (input: ContactUpsertInput): Promise<ClientContactRow | null> => {
      if (!agentId) return null;

      try {
        const res = await fetch("/api/workspace/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, ...input }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok: boolean; contact: ClientContactRow };

        // Optimistic list update
        setListState((s) => {
          const idx = s.contacts.findIndex((c) => c.id === data.contact.id);
          if (idx >= 0) {
            const updated = [...s.contacts];
            updated[idx] = data.contact;
            return { ...s, contacts: updated };
          }
          return { ...s, contacts: [data.contact, ...s.contacts], total: s.total + 1 };
        });

        return data.contact;
      } catch (err) {
        console.error("[useContacts] upsertContact error:", err);
        return null;
      }
    },
    [agentId],
  );

  // ── Delete contact ─────────────────────────────────────────────────────────

  const deleteContact = useCallback(
    async (id: string): Promise<boolean> => {
      if (!agentId) return false;

      // Optimistic remove from list
      setListState((s) => ({
        ...s,
        contacts: s.contacts.filter((c) => c.id !== id),
        total: Math.max(0, s.total - 1),
      }));

      try {
        const res = await fetch("/api/workspace/contact", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useContacts] deleteContact error:", err);
        setListState((s) => ({ ...s, error: `Delete failed: ${msg}` }));
        // Revert optimistic removal on failure
        void loadContacts(lastFiltersRef.current);
        return false;
      }
    },
    [agentId, loadContacts],
  );

  return {
    // List state
    contacts: listState.contacts,
    total: listState.total,
    loading: listState.loading,
    error: listState.error,
    // Detail state
    detailContact: detailState.contact,
    detailLoading: detailState.loading,
    detailError: detailState.error,
    // Actions
    loadContacts,
    loadContactDetail,
    clearDetail,
    upsertContact,
    deleteContact,
  };
}
