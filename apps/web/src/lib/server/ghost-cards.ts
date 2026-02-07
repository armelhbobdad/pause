import "server-only";

import { db } from "@pause/db";
import { ghostCard } from "@pause/db/schema";

/** Outcomes that qualify for Ghost card creation (Story 6.4, AC2). */
export const GHOST_QUALIFYING_OUTCOMES = [
  "accepted",
  "overridden",
  "wait",
  "auto_approved",
] as const;

/** Type aliases for enum value types */
type SatisfactionFeedback =
  typeof import("@pause/db/schema").satisfactionFeedbackEnum.enumValues[number];
type InteractionOutcome =
  typeof import("@pause/db/schema").interactionOutcomeEnum.enumValues[number];

/**
 * Maps satisfaction feedback x interaction outcome to learning signals (Story 6.6, AC2).
 * Uses `satisfies Record<>` for compile-time safety — adding a new enum value
 * without a mapping entry will cause a type error.
 */
export const satisfactionSignalMap = {
  worth_it: {
    accepted:
      "correct — user accepted Guardian's suggestion and is satisfied with the purchase",
    overridden:
      "incorrect — user overrode Guardian and is happy with the purchase; strategy was wrong to intervene",
    wait: "correct — user waited as suggested and is satisfied with the outcome",
    abandoned:
      "neutral — user abandoned interaction, satisfaction inconclusive",
    timeout: "neutral — interaction timed out, satisfaction inconclusive",
    auto_approved:
      "neutral — low-risk auto-approved, satisfaction not strongly attributable",
    break_glass:
      "neutral — system failure triggered break glass, satisfaction not attributable",
    wizard_bookmark:
      "neutral — user bookmarked reflection, satisfaction inconclusive",
    wizard_abandoned:
      "neutral — user abandoned wizard, satisfaction inconclusive",
  },
  regret_it: {
    accepted:
      "incorrect — user accepted Guardian's suggestion but later regretted the decision",
    overridden:
      "correct — user overrode Guardian and now regrets it; strategy was right and should have been stronger",
    wait: "incorrect — user waited as suggested but regrets waiting; should have acted sooner",
    abandoned: "neutral — user abandoned interaction, regret inconclusive",
    timeout: "neutral — interaction timed out, regret inconclusive",
    auto_approved:
      "neutral — low-risk auto-approved, regret not strongly attributable",
    break_glass:
      "neutral — system failure triggered break glass, regret not attributable",
    wizard_bookmark:
      "neutral — user bookmarked reflection, regret inconclusive",
    wizard_abandoned: "neutral — user abandoned wizard, regret inconclusive",
  },
  not_sure: {
    accepted: "neutral — user is unsure about the purchase decision",
    overridden: "neutral — user is unsure about the override decision",
    wait: "neutral — user is unsure about the wait decision",
    abandoned: "neutral — user abandoned interaction, no clear signal",
    timeout: "neutral — interaction timed out, no clear signal",
    auto_approved: "neutral — auto-approved, no clear signal",
    break_glass: "neutral — break glass, no clear signal",
    wizard_bookmark: "neutral — user bookmarked reflection, no clear signal",
    wizard_abandoned: "neutral — user abandoned wizard, no clear signal",
  },
} as const satisfies Record<
  SatisfactionFeedback,
  Record<InteractionOutcome, string>
>;

/**
 * Maps a satisfaction feedback + interaction outcome pair to a human-readable learning signal.
 * Returns a neutral signal with console warning for unknown or null inputs (AC2).
 */
export function satisfactionToFeedbackSignal(
  satisfaction: string,
  outcome: string
): string {
  const satisfactionRow =
    satisfactionSignalMap[satisfaction as SatisfactionFeedback];
  if (!satisfactionRow) {
    console.warn(
      `[SatisfactionMapping] Unknown satisfaction value: ${String(satisfaction)}`
    );
    return "neutral — unknown satisfaction feedback, no learning signal";
  }

  const signal = satisfactionRow[outcome as InteractionOutcome];
  if (!signal) {
    console.warn(
      `[SatisfactionMapping] Unknown outcome for ${satisfaction}: ${String(outcome)}`
    );
    return "neutral — unknown outcome, no learning signal";
  }

  return signal;
}

/** Creates a Ghost card record for a qualifying interaction.
 *  Catches unique constraint violations (idempotent) — logs, does not throw. */
export async function createGhostCard(params: {
  interactionId: string;
  userId: string;
}): Promise<void> {
  try {
    await db.insert(ghostCard).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      interactionId: params.interactionId,
    });
  } catch (error: unknown) {
    // Unique constraint violation on interactionId — idempotent, just log
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("unique") ||
      message.includes("duplicate") ||
      message.includes("23505")
    ) {
      console.warn(
        `[Ghost] Duplicate card for interaction ${params.interactionId}, skipping`
      );
      return;
    }
    // Re-throw unexpected errors
    throw error;
  }
}
