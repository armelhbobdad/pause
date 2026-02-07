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
