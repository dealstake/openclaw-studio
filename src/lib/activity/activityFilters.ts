/**
 * Shared filter interface for activity event queries.
 * Used by both the JSONL parser (sidecar fallback) and the DB repository.
 */
export interface BaseActivityFilters {
  type?: string | null;
  taskId?: string | null;
  projectSlug?: string | null;
  status?: string | null;
  limit: number;
  offset: number;
}
