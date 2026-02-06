/**
 * Skill deduplication module for ACE framework.
 *
 * This module provides semantic deduplication for skillbook skills using
 * embeddings and SkillManager-driven consolidation decisions.
 */

export type { DeduplicationConfig, EmbeddingProvider } from "./config";
export { createDeduplicationConfig } from "./config";
export { SimilarityDetector } from "./detector";
export { DeduplicationManager } from "./manager";
export type {
  ConsolidationOperation,
  DeleteOp,
  KeepOp,
  MergeOp,
  UpdateOp,
} from "./operations";
export { applyConsolidationOperations } from "./operations";
export { formatPairForLogging, generateSimilarityReport } from "./prompts";
