/**
 * Deduplication manager for coordinating similarity detection and operations.
 */

import type { Skillbook } from "../skillbook";
import type { DeduplicationConfig } from "./config";
import { createDeduplicationConfig } from "./config";
import { SimilarityDetector } from "./detector";
import {
  applyConsolidationOperations,
  type ConsolidationOperation,
  type DeleteOp,
  type KeepOp,
  type MergeOp,
  type UpdateOp,
} from "./operations";
import { formatPairForLogging, generateSimilarityReport } from "./prompts";

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARNING] ${msg}`),
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
};

export class DeduplicationManager {
  /**
   * Manages similarity detection and feeds info to SkillManager.
   *
   * This class coordinates:
   * 1. Computing/updating embeddings for skills
   * 2. Detecting similar skill pairs
   * 3. Generating similarity reports for the SkillManager prompt
   * 4. Parsing and applying consolidation operations from SkillManager
   *
   * Usage:
   *   const manager = new DeduplicationManager(config);
   *   const report = await manager.getSimilarityReport(skillbook);
   *   // Include report in SkillManager prompt...
   *   // After SkillManager responds:
   *   manager.applyOperationsFromResponse(skillManagerResponse, skillbook);
   */
  config: DeduplicationConfig;
  detector: SimilarityDetector;

  constructor(config?: DeduplicationConfig) {
    this.config = config || createDeduplicationConfig();
    this.detector = new SimilarityDetector(this.config);
  }

  async getSimilarityReport(skillbook: Skillbook): Promise<string | null> {
    /**
     * Generate similarity report to include in SkillManager prompt.
     *
     * This should be called BEFORE the SkillManager runs.
     *
     * Args:
     *   skillbook: The skillbook to analyze
     *
     * Returns:
     *   Formatted similarity report string, or null if no similar pairs found
     *   or deduplication is disabled
     */
    if (!this.config.enabled) {
      return null;
    }

    // Ensure all skills have embeddings
    await this.detector.ensureEmbeddings(skillbook);

    // Detect similar pairs
    const similarPairs = this.detector.detectSimilarPairs(skillbook);

    if (similarPairs.length < this.config.minPairsToReport) {
      if (similarPairs.length > 0) {
        logger.debug(
          `Found ${similarPairs.length} similar pairs, ` +
            `below threshold of ${this.config.minPairsToReport}`
        );
      }
      return null;
    }

    // Log found pairs
    logger.info(`Found ${similarPairs.length} similar skill pairs`);
    for (const [skillA, skillB, similarity] of similarPairs) {
      logger.debug(formatPairForLogging(skillA, skillB, similarity));
    }

    // Generate report
    return generateSimilarityReport(similarPairs);
  }

  parseConsolidationOperations(
    responseData: Record<string, any>
  ): ConsolidationOperation[] {
    /**
     * Parse consolidation operations from SkillManager response.
     *
     * Args:
     *   responseData: Parsed JSON response from SkillManager
     *
     * Returns:
     *   List of ConsolidationOperation objects
     */
    const operations: ConsolidationOperation[] = [];
    const rawOps = responseData.consolidation_operations || [];

    if (!Array.isArray(rawOps)) {
      logger.warning("consolidation_operations is not a list");
      return operations;
    }

    for (const rawOp of rawOps) {
      if (typeof rawOp !== "object" || rawOp === null) {
        continue;
      }

      const opType = (rawOp.type || "").toUpperCase();

      try {
        if (opType === "MERGE") {
          operations.push({
            type: "MERGE",
            source_ids: rawOp.source_ids || [],
            merged_content: rawOp.merged_content || "",
            keep_id: rawOp.keep_id || "",
            reasoning: rawOp.reasoning || "",
          } as MergeOp);
        } else if (opType === "DELETE") {
          operations.push({
            type: "DELETE",
            skill_id: rawOp.skill_id || "",
            reasoning: rawOp.reasoning || "",
          } as DeleteOp);
        } else if (opType === "KEEP") {
          operations.push({
            type: "KEEP",
            skill_ids: rawOp.skill_ids || [],
            differentiation: rawOp.differentiation || "",
            reasoning: rawOp.reasoning || "",
          } as KeepOp);
        } else if (opType === "UPDATE") {
          operations.push({
            type: "UPDATE",
            skill_id: rawOp.skill_id || "",
            new_content: rawOp.new_content || "",
            reasoning: rawOp.reasoning || "",
          } as UpdateOp);
        } else {
          logger.warning(`Unknown consolidation operation type: ${opType}`);
        }
      } catch (e: any) {
        logger.warning(`Failed to parse consolidation operation: ${e.message}`);
      }
    }

    logger.info(`Parsed ${operations.length} consolidation operations`);
    return operations;
  }

  applyOperations(
    operations: ConsolidationOperation[],
    skillbook: Skillbook
  ): void {
    /**
     * Apply consolidation operations to the skillbook.
     *
     * Args:
     *   operations: List of operations to apply
     *   skillbook: Skillbook to modify
     */
    if (!operations || operations.length === 0) {
      return;
    }

    logger.info(`Applying ${operations.length} consolidation operations`);
    applyConsolidationOperations(operations, skillbook);
  }

  applyOperationsFromResponse(
    responseData: Record<string, any>,
    skillbook: Skillbook
  ): ConsolidationOperation[] {
    /**
     * Parse and apply consolidation operations from SkillManager response.
     *
     * Convenience method that combines parse and apply.
     *
     * Args:
     *   responseData: Parsed JSON response from SkillManager
     *   skillbook: Skillbook to modify
     *
     * Returns:
     *   List of operations that were applied
     */
    const operations = this.parseConsolidationOperations(responseData);
    this.applyOperations(operations, skillbook);
    return operations;
  }
}
