/**
 * Similarity detection for skill deduplication.
 */

import { hasNumpy, hasSentenceTransformers, hasVercelAI } from "../features";
import type { Skill, Skillbook } from "../skillbook";
import type { DeduplicationConfig } from "./config";
import { createDeduplicationConfig } from "./config";

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARNING] ${msg}`),
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
};

export class SimilarityDetector {
  /**
   * Detect similar skill pairs using cosine similarity on embeddings.
   */
  config: DeduplicationConfig;

  constructor(config?: DeduplicationConfig) {
    this.config = config || createDeduplicationConfig();
  }

  async computeEmbedding(text: string): Promise<number[] | null> {
    /**
     * Compute embedding for a single text.
     *
     * Args:
     *   text: Text to embed
     *
     * Returns:
     *   Embedding vector as array of numbers, or null if embedding fails
     */
    if (this.config.embeddingProvider === "vercel-ai") {
      return this._computeEmbeddingVercelAI(text);
    }
    return this._computeEmbeddingSentenceTransformers(text);
  }

  async computeEmbeddingsBatch(
    texts: string[]
  ): Promise<Array<number[] | null>> {
    /**
     * Compute embeddings for multiple texts (more efficient).
     *
     * Args:
     *   texts: List of texts to embed
     *
     * Returns:
     *   List of embedding vectors (null for any that fail)
     */
    if (!texts || texts.length === 0) {
      return [];
    }

    if (this.config.embeddingProvider === "vercel-ai") {
      return this._computeEmbeddingsBatchVercelAI(texts);
    }
    return this._computeEmbeddingsBatchSentenceTransformers(texts);
  }

  private async _computeEmbeddingVercelAI(
    text: string
  ): Promise<number[] | null> {
    /**
     * Compute embedding using Vercel AI SDK.
     */
    if (!hasVercelAI()) {
      logger.warning("Vercel AI SDK not available for embeddings");
      return null;
    }

    try {
      const { embed } = await import("ai");
      const { openai } = await import("@ai-sdk/openai");

      const model = openai.embedding(this.config.embeddingModel);
      const result = await embed({
        model,
        value: text,
      });

      return result.embedding;
    } catch (e: any) {
      logger.warning(`Failed to compute embedding via Vercel AI: ${e.message}`);
      return null;
    }
  }

  private async _computeEmbeddingsBatchVercelAI(
    texts: string[]
  ): Promise<Array<number[] | null>> {
    /**
     * Batch compute embeddings using Vercel AI SDK.
     */
    if (!hasVercelAI()) {
      logger.warning("Vercel AI SDK not available for embeddings");
      return texts.map(() => null);
    }

    try {
      const { embedMany } = await import("ai");
      const { openai } = await import("@ai-sdk/openai");

      const model = openai.embedding(this.config.embeddingModel);
      const result = await embedMany({
        model,
        values: texts,
      });

      return result.embeddings;
    } catch (e: any) {
      logger.warning(
        `Failed to compute batch embeddings via Vercel AI: ${e.message}`
      );
      return texts.map(() => null);
    }
  }

  private async _computeEmbeddingSentenceTransformers(
    text: string
  ): Promise<number[] | null> {
    /**
     * Compute embedding using sentence-transformers (local).
     */
    if (!hasSentenceTransformers()) {
      logger.warning("sentence-transformers not available for embeddings");
      return null;
    }

    try {
      const model = await this._getSentenceTransformerModel();
      const embedding = await model.encode(text, { convertToNumpy: true });
      return Array.from(embedding);
    } catch (e: any) {
      logger.warning(
        `Failed to compute embedding via sentence-transformers: ${e.message}`
      );
      return null;
    }
  }

  private async _computeEmbeddingsBatchSentenceTransformers(
    texts: string[]
  ): Promise<Array<number[] | null>> {
    /**
     * Batch compute embeddings using sentence-transformers.
     */
    if (!hasSentenceTransformers()) {
      logger.warning("sentence-transformers not available for embeddings");
      return texts.map(() => null);
    }

    try {
      const model = await this._getSentenceTransformerModel();
      const embeddings = await model.encode(texts, { convertToNumpy: true });
      return embeddings.map((emb: any) => Array.from(emb));
    } catch (e: any) {
      logger.warning(
        `Failed to compute batch embeddings via sentence-transformers: ${e.message}`
      );
      return texts.map(() => null);
    }
  }

  private async _getSentenceTransformerModel(): Promise<any> {
    // sentence-transformers is a Python-only package — not available in Node.js
    throw new Error(
      "sentence-transformers is not available in Node.js environments"
    );
  }

  cosineSimilarity(a: number[], b: number[]): number {
    /**
     * Compute cosine similarity between two embedding vectors.
     *
     * Args:
     *   a: First embedding vector
     *   b: Second embedding vector
     *
     * Returns:
     *   Cosine similarity score between 0 and 1
     */
    if (!hasNumpy()) {
      // Fallback to pure TypeScript
      let dot = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
      }

      let normA = 0;
      for (const val of a) {
        normA += val * val;
      }
      normA = Math.sqrt(normA);

      let normB = 0;
      for (const val of b) {
        normB += val * val;
      }
      normB = Math.sqrt(normB);

      if (normA === 0 || normB === 0) {
        return 0.0;
      }
      return dot / (normA * normB);
    }

    // Note: numpy is not available in TypeScript/Node.js
    // We could use mathjs or tensorflow.js, but the pure implementation above is sufficient
    // Keeping this branch for consistency with Python version
    return this._cosineSimilarityPure(a, b);
  }

  private _cosineSimilarityPure(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }

    let normA = 0;
    for (const val of a) {
      normA += val * val;
    }
    normA = Math.sqrt(normA);

    let normB = 0;
    for (const val of b) {
      normB += val * val;
    }
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0.0;
    }
    return dot / (normA * normB);
  }

  async ensureEmbeddings(skillbook: Skillbook): Promise<number> {
    /**
     * Ensure all active skills have embeddings computed.
     *
     * Args:
     *   skillbook: Skillbook to process
     *
     * Returns:
     *   Number of embeddings computed
     */
    const skillsNeedingEmbeddings = skillbook
      .skills()
      .filter((s) => s.embedding === undefined);

    if (skillsNeedingEmbeddings.length === 0) {
      return 0;
    }

    const texts = skillsNeedingEmbeddings.map((s) => s.content);
    const embeddings = await this.computeEmbeddingsBatch(texts);

    let count = 0;
    for (let i = 0; i < skillsNeedingEmbeddings.length; i++) {
      const skill = skillsNeedingEmbeddings[i];
      const embedding = embeddings[i];
      if (embedding !== null) {
        skill.embedding = embedding;
        count++;
      }
    }

    logger.info(`Computed ${count} embeddings for skills`);
    return count;
  }

  detectSimilarPairs(
    skillbook: Skillbook,
    threshold?: number
  ): [Skill, Skill, number][] {
    /**
     * Find all pairs of skills with similarity >= threshold.
     *
     * Args:
     *   skillbook: Skillbook to search
     *   threshold: Similarity threshold (default: config.similarityThreshold)
     *
     * Returns:
     *   List of [skill_a, skill_b, similarity_score] tuples,
     *   sorted by similarity score descending
     */
    const thresholdValue = threshold ?? this.config.similarityThreshold;
    const similarPairs: [Skill, Skill, number][] = [];

    // Get active skills only
    const skills = skillbook.skills(false);

    // Group by section if configured
    if (this.config.withinSectionOnly) {
      const sections: Map<string, Skill[]> = new Map();
      for (const skill of skills) {
        const sectionSkills = sections.get(skill.section) || [];
        sectionSkills.push(skill);
        sections.set(skill.section, sectionSkills);
      }

      for (const sectionSkills of sections.values()) {
        const pairs = this._findSimilarInList(
          sectionSkills,
          skillbook,
          thresholdValue
        );
        similarPairs.push(...pairs);
      }
    } else {
      similarPairs.push(
        ...this._findSimilarInList(skills, skillbook, thresholdValue)
      );
    }

    // Sort by similarity descending
    similarPairs.sort((a, b) => b[2] - a[2]);
    return similarPairs;
  }

  private _findSimilarInList(
    skills: Skill[],
    skillbook: Skillbook,
    threshold: number
  ): [Skill, Skill, number][] {
    /**
     * Find similar pairs within a list of skills.
     */
    const pairs: [Skill, Skill, number][] = [];

    for (let i = 0; i < skills.length; i++) {
      const skillA = skills[i];
      if (skillA.embedding === undefined) {
        continue;
      }

      for (let j = i + 1; j < skills.length; j++) {
        const skillB = skills[j];
        if (skillB.embedding === undefined) {
          continue;
        }

        // Skip pairs with existing KEEP decisions
        if (skillbook.hasKeepDecision(skillA.id, skillB.id)) {
          continue;
        }

        const similarity = this.cosineSimilarity(
          skillA.embedding,
          skillB.embedding
        );

        if (similarity >= threshold) {
          pairs.push([skillA, skillB, similarity]);
        }
      }
    }

    return pairs;
  }
}
