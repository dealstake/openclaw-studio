/**
 * RAG (Retrieval-Augmented Generation) utilities.
 *
 * Phase 1: Chunking — split documents into FTS5-indexable pieces.
 * Phase 2: Ingestion service — scan knowledge dirs, ingest files/URLs.
 * Phase 3: Search — FTS5 BM25 search + context window expansion.
 */

export {
  chunkMarkdown,
  chunkPlainText,
  extractTextFromPdf,
  extractTextFromDocx,
  estimateTokens,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OVERLAP_TOKENS,
} from "./chunker";
