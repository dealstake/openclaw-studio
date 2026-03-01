import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";
import { contacts, interactions } from "../schema";
import type { ContactRow, InteractionRow } from "../schema";
import type { StudioDb } from "../index";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ContactFilters = {
  personaId?: string;
  stage?: string;
  /** JSON-encoded tag to filter by (exact element match via JSON contains) */
  tag?: string;
  /** Free-text search (delegated to FTS5 — use searchContacts for query-first flows) */
  q?: string;
  limit?: number;
  offset?: number;
};

/** A contact row augmented with its N most recent interactions. */
export type ContactWithInteractions = ContactRow & {
  recentInteractions: InteractionRow[];
};

/** Input shape for creating/updating a contact. */
export type ContactInput = {
  id?: string;
  personaId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  /** JSON array string or plain array (will be serialised). */
  tags?: string | string[] | null;
  stage?: string | null;
  notes?: string | null;
  metadata?: string | Record<string, unknown> | null;
};

/** Input shape for logging an interaction. */
export type InteractionInput = {
  id?: string;
  contactId: string;
  personaId: string;
  type: string;
  channel?: string | null;
  summary?: string | null;
  content?: string | null;
  outcome?: string | null;
  artifactLink?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseTags(tags: string | string[] | null | undefined): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) return JSON.stringify(tags);
  // Already a JSON string or plain string — try to normalise
  try {
    const parsed = JSON.parse(tags);
    return JSON.stringify(parsed);
  } catch {
    // Treat as a single-element tag
    return JSON.stringify([tags]);
  }
}

function normaliseMetadata(meta: string | Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  if (typeof meta === "string") return meta;
  return JSON.stringify(meta);
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── FTS5 sync helpers ────────────────────────────────────────────────────────

function ftsInsert(db: StudioDb, row: ContactRow): void {
  db.run(sql`
    INSERT INTO contacts_search(contact_id, agent_id, name, email, company, notes)
    VALUES (
      ${row.id},
      ${row.agentId},
      ${row.name ?? ""},
      ${row.email ?? ""},
      ${row.company ?? ""},
      ${row.notes ?? ""}
    )
  `);
}

function ftsDelete(db: StudioDb, contactId: string): void {
  db.run(sql`
    DELETE FROM contacts_search WHERE contact_id = ${contactId}
  `);
}

function ftsUpdate(db: StudioDb, row: ContactRow): void {
  ftsDelete(db, row.id);
  ftsInsert(db, row);
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * List contacts for an agent with optional persona scoping and filters.
 * Excludes soft-deleted contacts. Paginates with limit/offset.
 */
export function listContacts(
  db: StudioDb,
  agentId: string,
  filters: ContactFilters = {},
): { contacts: ContactRow[]; total: number } {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  const conditions = [
    eq(contacts.agentId, agentId),
    isNull(contacts.deletedAt),
  ];

  if (filters.personaId) {
    conditions.push(eq(contacts.personaId, filters.personaId));
  }
  if (filters.stage) {
    conditions.push(eq(contacts.stage, filters.stage));
  }

  const where = and(...conditions);

  let rows = db
    .select()
    .from(contacts)
    .where(where)
    .orderBy(asc(contacts.name))
    .all();

  // In-memory tag filter (SQLite JSON contains is brittle across versions)
  if (filters.tag) {
    const tag = filters.tag;
    rows = rows.filter((r) => {
      if (!r.tags) return false;
      try {
        const tags = JSON.parse(r.tags) as string[];
        return tags.includes(tag);
      } catch {
        return false;
      }
    });
  }

  const total = rows.length;
  const paginated = rows.slice(offset, offset + limit);

  return { contacts: paginated, total };
}

/**
 * Get a single contact by ID, scoped to agentId. Returns null if not found or
 * soft-deleted. Includes up to 10 most recent interactions.
 */
export function getContact(
  db: StudioDb,
  agentId: string,
  id: string,
): ContactWithInteractions | null {
  const row = db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.agentId, agentId),
        isNull(contacts.deletedAt),
      ),
    )
    .get();

  if (!row) return null;

  const recentInteractions = db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.createdAt))
    .limit(10)
    .all();

  return { ...row, recentInteractions };
}

/**
 * Create or update a contact. Deduplicates by email within the same agentId:
 * if a contact with the same email already exists (and is not soft-deleted),
 * that record is updated instead of inserting a duplicate.
 * Returns the resulting contact row.
 */
export function upsertContact(
  db: StudioDb,
  agentId: string,
  input: ContactInput,
): ContactRow {
  const now = new Date().toISOString();
  const tagsJson = normaliseTags(input.tags);
  const metadataJson = normaliseMetadata(input.metadata);

  // Email-based deduplication
  let existingId: string | null = null;
  if (input.email) {
    const existing = db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.agentId, agentId),
          eq(contacts.email, input.email),
          isNull(contacts.deletedAt),
        ),
      )
      .get();
    if (existing) {
      existingId = existing.id;
    }
  }

  const id = existingId ?? input.id ?? generateId();

  if (existingId) {
    // Update existing record
    db.update(contacts)
      .set({
        personaId: input.personaId ?? undefined,
        name: input.name,
        email: input.email ?? undefined,
        phone: input.phone ?? undefined,
        company: input.company ?? undefined,
        title: input.title ?? undefined,
        tags: tagsJson ?? undefined,
        stage: input.stage ?? undefined,
        notes: input.notes ?? undefined,
        metadata: metadataJson ?? undefined,
        updatedAt: now,
      })
      .where(eq(contacts.id, id))
      .run();
  } else {
    // Insert new record
    db.insert(contacts)
      .values({
        id,
        agentId,
        personaId: input.personaId ?? null,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        title: input.title ?? null,
        tags: tagsJson,
        stage: input.stage ?? null,
        notes: input.notes ?? null,
        metadata: metadataJson,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: contacts.id,
        set: {
          personaId: input.personaId ?? null,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company: input.company ?? null,
          title: input.title ?? null,
          tags: tagsJson,
          stage: input.stage ?? null,
          notes: input.notes ?? null,
          metadata: metadataJson,
          updatedAt: now,
        },
      })
      .run();
  }

  // Fetch the final row to sync FTS and return
  const saved = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();

  if (!saved) {
    throw new Error(`[contactsRepo] upsert failed: contact ${id} not found after write`);
  }

  // Sync FTS5 index
  ftsUpdate(db, saved);

  return saved;
}

/**
 * Soft-delete a contact by setting `deleted_at`. Also removes from FTS5 index.
 * Returns true if the contact was found and deleted.
 */
export function deleteContact(
  db: StudioDb,
  agentId: string,
  id: string,
): boolean {
  const result = db
    .update(contacts)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.agentId, agentId),
        isNull(contacts.deletedAt),
      ),
    )
    .run();

  if (result.changes > 0) {
    ftsDelete(db, id);
    return true;
  }
  return false;
}

/**
 * Full-text search across name, email, company, and notes via FTS5.
 * Returns matching contacts (excluding soft-deleted), ordered by relevance.
 */
export function searchContacts(
  db: StudioDb,
  agentId: string,
  query: string,
  limit = 20,
): ContactRow[] {
  const safeLimit = Math.min(limit, 100);

  // Query the FTS5 table for matching contact IDs
  const ftsRows = db.all(sql`
    SELECT
      contact_id AS contactId,
      agent_id   AS agentId,
      name,
      email,
      company,
      notes,
      rank
    FROM contacts_search
    WHERE contacts_search MATCH ${query}
      AND agent_id = ${agentId}
    ORDER BY rank
    LIMIT ${safeLimit}
  `) as Array<{ contactId: string; agentId: string; name: string; email: string; company: string; notes: string; rank: number }>;

  if (!ftsRows.length) return [];

  const ids = ftsRows.map((r) => r.contactId);

  // Fetch full rows in a single query and preserve FTS rank order
  const rows = db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.agentId, agentId),
        isNull(contacts.deletedAt),
      ),
    )
    .all();

  const rowMap = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => rowMap.get(id)).filter((r): r is ContactRow => r !== undefined);
}

/**
 * Log an interaction for a contact. Returns the created interaction row.
 */
export function logInteraction(
  db: StudioDb,
  agentId: string,
  input: InteractionInput,
): InteractionRow {
  const id = input.id ?? generateId();
  const now = new Date().toISOString();

  db.insert(interactions)
    .values({
      id,
      contactId: input.contactId,
      agentId,
      personaId: input.personaId,
      type: input.type,
      channel: input.channel ?? null,
      summary: input.summary ?? null,
      content: input.content ?? null,
      outcome: input.outcome ?? null,
      artifactLink: input.artifactLink ?? null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();

  // Also bump contact's updatedAt so list views reflect recent activity
  db.update(contacts)
    .set({ updatedAt: now })
    .where(eq(contacts.id, input.contactId))
    .run();

  const saved = db
    .select()
    .from(interactions)
    .where(eq(interactions.id, id))
    .get();

  if (!saved) {
    throw new Error(`[contactsRepo] logInteraction failed: interaction ${id} not found after write`);
  }

  return saved;
}

/**
 * Get chronological interaction history for a contact, paginated.
 */
export function getInteractionHistory(
  db: StudioDb,
  agentId: string,
  contactId: string,
  limit = 50,
  offset = 0,
): { interactions: InteractionRow[]; total: number } {
  const safeLimit = Math.min(limit, 200);

  const where = and(
    eq(interactions.contactId, contactId),
    eq(interactions.agentId, agentId),
  );

  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(interactions)
    .where(where)
    .get();

  const total = countResult?.count ?? 0;

  const rows = db
    .select()
    .from(interactions)
    .where(where)
    .orderBy(desc(interactions.createdAt))
    .limit(safeLimit)
    .offset(offset)
    .all();

  return { interactions: rows, total };
}

/**
 * Get all active contacts for an agent/persona in a specific pipeline stage.
 * Useful for kanban/pipeline views.
 */
export function getContactsByStage(
  db: StudioDb,
  agentId: string,
  personaId: string,
  stage: string,
): ContactRow[] {
  return db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.agentId, agentId),
        eq(contacts.personaId, personaId),
        eq(contacts.stage, stage),
        isNull(contacts.deletedAt),
      ),
    )
    .orderBy(asc(contacts.name))
    .all();
}
