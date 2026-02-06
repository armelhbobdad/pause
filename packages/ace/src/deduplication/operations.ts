/**
 * Consolidation operations for skill deduplication.
 */

import type { SimilarityDecision, Skillbook } from "../skillbook";

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARNING] ${msg}`),
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
};

export interface MergeOp {
  /**
   * Merge multiple skills into one.
   *
   * Combines helpful/harmful counts from all source skills into the kept skill.
   * Other skills are soft-deleted.
   */
  type: "MERGE";
  source_ids: string[]; // All skills being merged
  merged_content: string; // New combined content
  keep_id: string; // Which ID to keep (others deleted)
  reasoning: string;
}

export interface DeleteOp {
  /**
   * Soft-delete a skill as redundant.
   */
  type: "DELETE";
  skill_id: string;
  reasoning: string;
}

export interface KeepOp {
  /**
   * Keep both skills separate (they serve different purposes).
   */
  type: "KEEP";
  skill_ids: string[];
  differentiation: string; // How they differ
  reasoning: string;
}

export interface UpdateOp {
  /**
   * Update a skill's content to differentiate it.
   */
  type: "UPDATE";
  skill_id: string;
  new_content: string;
  reasoning: string;
}

// Type alias for any consolidation operation
export type ConsolidationOperation = MergeOp | DeleteOp | KeepOp | UpdateOp;

export function applyConsolidationOperations(
  operations: ConsolidationOperation[],
  skillbook: Skillbook
): void {
  /**
   * Apply a list of consolidation operations to a skillbook.
   *
   * Args:
   *   operations: List of operations to apply
   *   skillbook: Skillbook to modify
   */
  for (const op of operations) {
    if (op.type === "MERGE") {
      applyMerge(op, skillbook);
    } else if (op.type === "DELETE") {
      applyDelete(op, skillbook);
    } else if (op.type === "KEEP") {
      applyKeep(op, skillbook);
    } else if (op.type === "UPDATE") {
      applyUpdate(op, skillbook);
    } else {
      logger.warning(`Unknown operation type: ${(op as any).type}`);
    }
  }
}

function applyMerge(op: MergeOp, skillbook: Skillbook): void {
  /**
   * Apply a MERGE operation.
   */
  const keepSkill = skillbook.getSkill(op.keep_id);
  if (keepSkill === null) {
    logger.warning(`MERGE: Keep skill ${op.keep_id} not found`);
    return;
  }

  // Combine metadata from all source skills
  for (const sourceId of op.source_ids) {
    if (sourceId === op.keep_id) {
      continue;
    }

    const source = skillbook.getSkill(sourceId);
    if (source === null) {
      logger.warning(`MERGE: Source skill ${sourceId} not found`);
      continue;
    }

    // Combine counters
    keepSkill.helpful += source.helpful;
    keepSkill.harmful += source.harmful;
    keepSkill.neutral += source.neutral;

    // Soft delete source
    skillbook.removeSkill(sourceId, true);
    logger.info(`MERGE: Soft-deleted ${sourceId} into ${op.keep_id}`);
  }

  // Update content to merged version
  if (op.merged_content) {
    keepSkill.content = op.merged_content;
  }

  // Invalidate embedding (needs recomputation)
  keepSkill.embedding = undefined;
  keepSkill.updated_at = new Date().toISOString();

  logger.info(`MERGE: Completed merge into ${op.keep_id}`);
}

function applyDelete(op: DeleteOp, skillbook: Skillbook): void {
  /**
   * Apply a DELETE operation (soft delete).
   */
  const skill = skillbook.getSkill(op.skill_id);
  if (skill === null) {
    logger.warning(`DELETE: Skill ${op.skill_id} not found`);
    return;
  }

  skillbook.removeSkill(op.skill_id, true);
  logger.info(`DELETE: Soft-deleted ${op.skill_id}`);
}

function applyKeep(op: KeepOp, skillbook: Skillbook): void {
  /**
   * Apply a KEEP operation (store decision).
   */
  if (op.skill_ids.length < 2) {
    logger.warning("KEEP: Need at least 2 skill IDs");
    return;
  }

  // Store decision for each pair
  for (let i = 0; i < op.skill_ids.length; i++) {
    const idA = op.skill_ids[i];
    for (let j = i + 1; j < op.skill_ids.length; j++) {
      const idB = op.skill_ids[j];

      const decision: SimilarityDecision = {
        decision: "KEEP",
        reasoning: op.reasoning || op.differentiation,
        decided_at: new Date().toISOString(),
        similarity_at_decision: 0.0, // We don't have the score here
      };

      skillbook.setSimilarityDecision(idA, idB, decision);
      logger.info(`KEEP: Stored decision for (${idA}, ${idB})`);
    }
  }
}

function applyUpdate(op: UpdateOp, skillbook: Skillbook): void {
  /**
   * Apply an UPDATE operation.
   */
  const skill = skillbook.getSkill(op.skill_id);
  if (skill === null) {
    logger.warning(`UPDATE: Skill ${op.skill_id} not found`);
    return;
  }

  skill.content = op.new_content;
  skill.embedding = undefined; // Needs recomputation
  skill.updated_at = new Date().toISOString();
  logger.info(`UPDATE: Updated content of ${op.skill_id}`);
}
