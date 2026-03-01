-- Migration 0012: Fix knowledge_chunks FTS5 table
--
-- The table created in 0011 used content='' (contentless FTS5), which prevents
-- retrieving chunk text for RAG. We drop and recreate with:
--   - chunk_index UNINDEXED: tracks position within a source for context retrieval
--   - content (searchable): stores the actual chunk text
--   - porter+unicode61 tokenizer: stemming + full Unicode support
--
DROP TABLE IF EXISTS knowledge_chunks;
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks USING fts5(
	persona_id UNINDEXED,
	source_id UNINDEXED,
	chunk_index UNINDEXED,
	content,
	tokenize = 'porter unicode61'
);
