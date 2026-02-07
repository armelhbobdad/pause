import "server-only";

import { google } from "@ai-sdk/google";
import { db } from "@pause/db";
import { interaction, skillbook as skillbookTable } from "@pause/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { ReflectorOutput, UpdateBatch } from "@/lib/server/ace";
import {
  loadUserSkillbookInstance,
  Reflector,
  type Skillbook,
  SkillManager,
  VercelAIClient,
} from "@/lib/server/ace";
import { getOpikClient } from "@/lib/server/opik";
import { withTimeout } from "@/lib/server/utils";

const REFLECTION_TIMEOUT_MS = 10_000;
const CURATION_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const DB_TIMEOUT_MS = 10_000;

/** Lazy-initialized singleton Reflector */
let reflectorInstance: InstanceType<typeof Reflector> | null = null;

function getReflector(): InstanceType<typeof Reflector> {
  if (reflectorInstance) {
    return reflectorInstance;
  }
  const llm = new VercelAIClient({
    model: google("gemini-2.5-flash"),
  });
  reflectorInstance = new Reflector(llm);
  return reflectorInstance;
}

/** Lazy-initialized singleton SkillManager (AC7) */
let skillManagerInstance: InstanceType<typeof SkillManager> | null = null;

function getSkillManager(): InstanceType<typeof SkillManager> {
  if (skillManagerInstance) {
    return skillManagerInstance;
  }
  const llm = new VercelAIClient({
    model: google("gemini-2.5-flash"),
  });
  skillManagerInstance = new SkillManager(llm);
  return skillManagerInstance;
}

/**
 * Maps DB outcome enums to natural-language feedback signals for the Reflector.
 * Uses `satisfies Record<>` to get a compile error if a new outcome is added
 * to the DB enum without a corresponding feedback signal mapping.
 */
const feedbackSignalMap = {
  accepted: "correct — user accepted the Guardian's suggestion",
  overridden: "incorrect — user overrode the Guardian's suggestion",
  wait: "correct — user chose to wait as suggested",
  abandoned: "neutral — user abandoned the interaction without deciding",
  auto_approved: "neutral — low-risk auto-approved, no intervention needed",
  break_glass: "neutral — system failure triggered break glass fallback",
  timeout: "neutral — interaction timed out",
  wizard_bookmark: "correct — user bookmarked reflection for later",
  wizard_abandoned: "neutral — user started wizard but abandoned",
} as const satisfies Record<
  typeof import("@pause/db/schema").interactionOutcomeEnum.enumValues[number],
  string
>;

/** Result type returned by runReflection for downstream consumers (Story 6.3) */
export interface LearningPipelineResult {
  reflectionOutput: ReflectorOutput;
  interactionId: string;
  userId: string;
  skillbook: Skillbook;
  skillbookVersion: number;
}

/**
 * Runs the ACE Reflector on a completed interaction to extract learnings.
 * Returns the ReflectorOutput for Story 6.3 SkillManager consumption, or null on failure.
 */
export async function runReflection(params: {
  interactionId: string;
  userId: string;
  question: string;
  generatorAnswer: string;
  outcome: string;
}): Promise<LearningPipelineResult | null> {
  const { interactionId, userId, question, generatorAnswer, outcome } = params;

  const feedbackSignal =
    feedbackSignalMap[outcome as keyof typeof feedbackSignalMap] ??
    `neutral — unknown outcome: ${outcome}`;

  try {
    // Load user's Skillbook instance (passed through for SkillManager in Story 6.3)
    const { skillbook, version: skillbookVersion } =
      await loadUserSkillbookInstance(userId);

    const reflector = getReflector();

    // Run reflection with timeout (clear timer on all paths to prevent leaks)
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const reflectionOutput = await Promise.race([
      reflector.reflect({
        question,
        generatorAnswer,
        feedback: feedbackSignal,
        skillbook,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Reflection timed out")),
          REFLECTION_TIMEOUT_MS
        );
      }),
    ]).finally(() => clearTimeout(timeoutId));

    return {
      reflectionOutput,
      interactionId,
      userId,
      skillbook,
      skillbookVersion,
    };
  } catch (error) {
    console.warn(
      `[Learning] Reflection failed for interaction ${interactionId}:`,
      error
    );
    console.warn(
      `[Learning] RETRY_QUEUE: ${JSON.stringify({
        interactionId,
        userId,
        timestamp: new Date().toISOString(),
      })}`
    );
    return null;
  }
}

/**
 * Persists a Skillbook to DB using optimistic locking (ADR-008).
 * Returns true if the write succeeded, false on version conflict.
 */
async function persistSkillbookUpdate(
  userId: string,
  updatedSkillbook: Skillbook,
  expectedVersion: number
): Promise<boolean> {
  const result = await withTimeout(
    db
      .update(skillbookTable)
      .set({
        skills: updatedSkillbook.toDict(),
        version: sql`${skillbookTable.version} + 1`,
      })
      .where(
        and(
          eq(skillbookTable.userId, userId),
          eq(skillbookTable.version, expectedVersion)
        )
      ),
    DB_TIMEOUT_MS
  );

  return (result as unknown as { rowCount: number }).rowCount > 0;
}

/**
 * Runs SkillManager curation and persists Skillbook updates with optimistic locking (AC1-AC4, AC6-AC8).
 * Takes the LearningPipelineResult (with pre-loaded Skillbook) to avoid redundant DB reads.
 * Returns the UpdateBatch on success, or null on failure.
 */
export async function runSkillUpdate(
  result: LearningPipelineResult
): Promise<UpdateBatch | null> {
  const { interactionId, userId, skillbook, skillbookVersion } = result;
  const skillCountBefore = skillbook.skills().length;

  try {
    const skillManager = getSkillManager();

    // Run SkillManager curation with timeout (AC7)
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const updateBatch: UpdateBatch = await Promise.race([
      skillManager.curate({
        reflectionAnalysis: result.reflectionOutput.analysis,
        skillbook,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("SkillManager curation timed out")),
          CURATION_TIMEOUT_MS
        );
      }),
    ]).finally(() => clearTimeout(timeoutId));

    // Apply UpdateBatch to in-memory Skillbook (AC2)
    // NOTE: This mutates the skillbook from the pipeline result in-place.
    // Safe because the result is consumed only once in runLearningPipeline().
    skillbook.applyUpdate(updateBatch);

    // Persist with optimistic locking retry loop (AC3, AC4)
    let currentSkillbook = skillbook;
    let currentVersion = skillbookVersion;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Reload fresh Skillbook and re-apply the same UpdateBatch
        const fresh = await loadUserSkillbookInstance(userId);
        currentSkillbook = fresh.skillbook;
        currentVersion = fresh.version;
        currentSkillbook.applyUpdate(updateBatch);
      }

      const success = await persistSkillbookUpdate(
        userId,
        currentSkillbook,
        currentVersion
      );

      if (success) {
        const skillCountAfter = currentSkillbook.skills().length;
        // Create Opik trace for skill update (AC5)
        attachSkillUpdateToTrace(
          interactionId,
          updateBatch,
          skillCountBefore,
          skillCountAfter
        );
        return updateBatch;
      }

      // Handle new user INSERT case: version 0 means no row exists
      if (currentVersion === 0 && attempt === 0) {
        try {
          await withTimeout(
            db.insert(skillbookTable).values({
              id: crypto.randomUUID(),
              userId,
              skills: currentSkillbook.toDict(),
              version: 1,
            }),
            DB_TIMEOUT_MS
          );
          const skillCountAfter = currentSkillbook.skills().length;
          attachSkillUpdateToTrace(
            interactionId,
            updateBatch,
            skillCountBefore,
            skillCountAfter
          );
          return updateBatch;
        } catch {
          // INSERT conflict — another request beat us. Continue retry loop with UPDATE.
        }
      }

      console.warn(
        `[Learning] Version conflict on attempt ${attempt + 1} for user ${userId}`
      );
    }

    // All retries exhausted (AC4)
    console.warn(
      `[Learning] RETRY_QUEUE: ${JSON.stringify({
        type: "skillbook_update",
        userId,
        interactionId,
        timestamp: new Date().toISOString(),
      })}`
    );
    return null;
  } catch (error) {
    // SkillManager failure, timeout, or DB failure — isolated (AC6)
    console.warn(
      `[Learning] Skill update failed for interaction ${interactionId}:`,
      error
    );
    return null;
  }
}

/**
 * Creates a learning:skillbook_update Opik trace (AC5).
 * Fire-and-forget — errors are logged but don't affect the pipeline.
 */
export function attachSkillUpdateToTrace(
  interactionId: string,
  updateBatch: UpdateBatch,
  skillCountBefore: number,
  skillCountAfter: number
): void {
  try {
    const client = getOpikClient();
    if (!client) {
      return;
    }

    const learningTrace = client.trace({
      name: "learning:skillbook_update",
      input: {
        interactionId,
        operationCount: updateBatch.operations.length,
        skillCountBefore,
        skillCountAfter,
        reasoning: updateBatch.reasoning,
        operations: updateBatch.operations.map((op) => ({
          type: op.type,
          section: op.section,
          skill_id: op.skill_id,
        })),
      },
    });
    learningTrace.end();
    client.flush().catch(() => {
      // Flush failures are non-critical
    });
  } catch {
    // Telemetry failures must never disrupt the learning pipeline
  }
}

/**
 * Attaches reflection results to Opik trace for observability (ADR-007).
 * Creates a learning trace linked to the original guardian trace via interactionId.
 */
export async function attachReflectionToTrace(
  interactionId: string,
  reflectionOutput: ReflectorOutput
): Promise<void> {
  const client = getOpikClient();
  if (!client) {
    return;
  }

  const traces = await client.searchTraces({
    filterString: `name = "guardian-${interactionId}"`,
    waitForAtLeast: 1,
    waitForTimeout: 5000,
  });

  if (traces.length > 0) {
    const learningTrace = client.trace({
      name: "learning:reflection",
      input: {
        interactionId,
        parentTraceId: traces[0].id,
        reflectionAnalysis: reflectionOutput.analysis,
        helpfulSkillIds: reflectionOutput.helpful_skill_ids,
        harmfulSkillIds: reflectionOutput.harmful_skill_ids,
        newLearningsCount: reflectionOutput.new_learnings.length,
      },
    });
    learningTrace.end();
    await client.flush();
  }
}

/**
 * Updates interaction status to learning_complete after successful reflection.
 */
export async function markLearningComplete(
  interactionId: string
): Promise<void> {
  await db
    .update(interaction)
    .set({ status: "learning_complete" })
    .where(eq(interaction.id, interactionId));
}
