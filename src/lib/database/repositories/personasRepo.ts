import { eq, desc } from "drizzle-orm";
import {
  personas,
  knowledgeSources,
  type PersonaRow,
  type NewPersonaRow,
  type KnowledgeSourceRow,
  type NewKnowledgeSourceRow,
} from "../schema";
import type { StudioDb } from "../index";

// ---------------------------------------------------------------------------
// Personas CRUD
// ---------------------------------------------------------------------------

/** List all personas, newest first. */
export function listAll(db: StudioDb): PersonaRow[] {
  return db
    .select()
    .from(personas)
    .orderBy(desc(personas.createdAt))
    .all();
}

/** List personas filtered by status. */
export function listByStatus(db: StudioDb, status: string): PersonaRow[] {
  return db
    .select()
    .from(personas)
    .where(eq(personas.status, status))
    .orderBy(desc(personas.createdAt))
    .all();
}

/** List personas filtered by category. */
export function listByCategory(db: StudioDb, category: string): PersonaRow[] {
  return db
    .select()
    .from(personas)
    .where(eq(personas.category, category))
    .orderBy(desc(personas.createdAt))
    .all();
}

/** Get a single persona by ID. */
export function getById(db: StudioDb, personaId: string): PersonaRow | undefined {
  return db
    .select()
    .from(personas)
    .where(eq(personas.personaId, personaId))
    .get();
}

/** Insert a new persona. */
export function create(db: StudioDb, row: NewPersonaRow): void {
  db.insert(personas).values(row).run();
}

/** Update persona fields by ID. */
export function update(
  db: StudioDb,
  personaId: string,
  fields: Partial<Omit<NewPersonaRow, "personaId">>,
): void {
  db.update(personas)
    .set(fields)
    .where(eq(personas.personaId, personaId))
    .run();
}

/** Delete a persona (cascades to knowledge_sources). */
export function remove(db: StudioDb, personaId: string): void {
  db.delete(personas)
    .where(eq(personas.personaId, personaId))
    .run();
}

/** Update practice metrics after a practice session. */
export function updatePracticeMetrics(
  db: StudioDb,
  personaId: string,
  metricsJson: string,
  practiceCount: number,
  lastTrainedAt: string,
): void {
  db.update(personas)
    .set({ metricsJson, practiceCount, lastTrainedAt })
    .where(eq(personas.personaId, personaId))
    .run();
}

/** Update persona status with validation. */
export function setStatus(
  db: StudioDb,
  personaId: string,
  status: string,
): void {
  db.update(personas)
    .set({ status })
    .where(eq(personas.personaId, personaId))
    .run();
}

// ---------------------------------------------------------------------------
// Knowledge Sources
// ---------------------------------------------------------------------------

/** List knowledge sources for a persona. */
export function listKnowledgeSources(
  db: StudioDb,
  personaId: string,
): KnowledgeSourceRow[] {
  return db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.personaId, personaId))
    .orderBy(desc(knowledgeSources.fetchedAt))
    .all();
}

/** Add a knowledge source. */
export function addKnowledgeSource(
  db: StudioDb,
  row: NewKnowledgeSourceRow,
): void {
  db.insert(knowledgeSources).values(row).run();
}

/** Remove a knowledge source by ID. */
export function removeKnowledgeSource(db: StudioDb, id: number): void {
  db.delete(knowledgeSources)
    .where(eq(knowledgeSources.id, id))
    .run();
}
