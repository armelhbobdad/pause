/**
 * Configuration for skill deduplication.
 */

export type EmbeddingProvider = "vercel-ai" | "sentence-transformers";

export interface DeduplicationConfig {
  /**
   * Configuration for skill deduplication.
   *
   * @property enabled - Whether deduplication is enabled (default: true)
   * @property embeddingModel - Model to use for computing embeddings
   * @property embeddingProvider - Provider for embeddings ('vercel-ai' or 'sentence-transformers')
   * @property similarityThreshold - Minimum similarity score to consider skills as similar
   * @property minPairsToReport - Minimum number of similar pairs before including in SkillManager prompt
   * @property withinSectionOnly - If true, only compare skills within the same section
   * @property localModelName - Optional: sentence-transformers model (used if embeddingProvider='sentence-transformers')
   */

  // Feature flags
  enabled: boolean;

  // Embedding settings
  embeddingModel: string;
  embeddingProvider: EmbeddingProvider;

  // Similarity thresholds
  similarityThreshold: number;

  // Cost control: only report similar pairs if >= this many found
  minPairsToReport: number;

  // Scope
  withinSectionOnly: boolean;

  // Optional: sentence-transformers model (used if embeddingProvider='sentence-transformers')
  localModelName: string;
}

export function createDeduplicationConfig(
  overrides?: Partial<DeduplicationConfig>
): DeduplicationConfig {
  return {
    enabled: true,
    embeddingModel: "text-embedding-3-small",
    embeddingProvider: "vercel-ai",
    similarityThreshold: 0.85,
    minPairsToReport: 1,
    withinSectionOnly: true,
    localModelName: "all-MiniLM-L6-v2",
    ...overrides,
  };
}
