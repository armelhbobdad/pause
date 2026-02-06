/**
 * Update operations produced by the ACE SkillManager.
 */

export type OperationType = "ADD" | "UPDATE" | "TAG" | "REMOVE";

export interface UpdateOperation {
  /** Single mutation to apply to the skillbook */
  type: OperationType;
  section: string;
  content?: string;
  skill_id?: string;
  metadata?: Record<string, number>;
}

export function createUpdateOperation(params: {
  type: OperationType;
  section: string;
  content?: string;
  skill_id?: string;
  metadata?: Record<string, number>;
}): UpdateOperation {
  return {
    type: params.type,
    section: params.section,
    content: params.content,
    skill_id: params.skill_id,
    metadata: params.metadata ?? {},
  };
}

export function updateOperationFromJSON(
  payload: Record<string, any>
): UpdateOperation {
  // Filter metadata for TAG operations to only include valid tags
  let metadata: Record<string, number> = payload.metadata ?? {};

  const opType = String(payload.type).toUpperCase();
  if (opType === "TAG") {
    // Only include valid tag names for TAG operations
    const validTags = new Set(["helpful", "harmful", "neutral"]);
    metadata = Object.fromEntries(
      Object.entries(metadata).filter(([k]) => validTags.has(k))
    );
  }

  if (!["ADD", "UPDATE", "TAG", "REMOVE"].includes(opType)) {
    throw new Error(`Invalid operation type: ${opType}`);
  }

  return {
    type: opType as OperationType,
    section: String(payload.section ?? ""),
    content:
      payload.content !== undefined && payload.content !== null
        ? String(payload.content)
        : undefined,
    skill_id:
      payload.skill_id !== undefined && payload.skill_id !== null
        ? String(payload.skill_id)
        : undefined,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [String(k), Number(v)])
    ),
  };
}

export function updateOperationToJSON(
  operation: UpdateOperation
): Record<string, any> {
  const data: Record<string, any> = {
    type: operation.type,
    section: operation.section,
  };

  if (operation.content !== undefined) {
    data.content = operation.content;
  }
  if (operation.skill_id !== undefined) {
    data.skill_id = operation.skill_id;
  }
  if (operation.metadata && Object.keys(operation.metadata).length > 0) {
    data.metadata = operation.metadata;
  }

  return data;
}

export interface UpdateBatch {
  /** Bundle of skill manager reasoning and operations */
  reasoning: string;
  operations: UpdateOperation[];
}

export function createUpdateBatch(params: {
  reasoning: string;
  operations?: UpdateOperation[];
}): UpdateBatch {
  return {
    reasoning: params.reasoning,
    operations: params.operations ?? [],
  };
}

export function updateBatchFromJSON(payload: Record<string, any>): UpdateBatch {
  const operations: UpdateOperation[] = [];
  const opsPayload = payload.operations;

  if (Array.isArray(opsPayload)) {
    for (const item of opsPayload) {
      if (typeof item === "object" && item !== null) {
        operations.push(updateOperationFromJSON(item));
      }
    }
  }

  return {
    reasoning: String(payload.reasoning ?? ""),
    operations,
  };
}

export function updateBatchToJSON(batch: UpdateBatch): Record<string, any> {
  return {
    reasoning: batch.reasoning,
    operations: batch.operations.map((op) => updateOperationToJSON(op)),
  };
}
