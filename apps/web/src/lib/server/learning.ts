import "server-only";

import { google } from "@ai-sdk/google";
import { db } from "@pause/db";
import { interaction } from "@pause/db/schema";
import { eq } from "drizzle-orm";
import type { ReflectorOutput } from "@/lib/server/ace";
import {
  loadUserSkillbookInstance,
  Reflector,
  VercelAIClient,
} from "@/lib/server/ace";
import { getOpikClient } from "@/lib/server/opik";

const REFLECTION_TIMEOUT_MS = 10_000;

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
    // Load user's Skillbook instance
    const { skillbook } = await loadUserSkillbookInstance(userId);

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

    return { reflectionOutput, interactionId, userId };
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
