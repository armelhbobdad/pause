/**
 * Skill deduplication module for ACE framework.
 *
 * This module provides semantic deduplication for skillbook skills using
 * embeddings and SkillManager-driven consolidation decisions.
 */

export type { DeduplicationConfig, EmbeddingProvider } from "./config.js";
export { createDeduplicationConfig } from "./config.js";
export { SimilarityDetector } from "./detector.js";
export { DeduplicationManager } from "./manager.js";
export type {
  ConsolidationOperation,
  DeleteOp,
  KeepOp,
  MergeOp,
  UpdateOp,
} from "./operations.js";
export { applyConsolidationOperations } from "./operations.js";
export { formatPairForLogging, generateSimilarityReport } from "./prompts.js";
