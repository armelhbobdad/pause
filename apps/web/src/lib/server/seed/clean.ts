/**
 * Demo data cleanup utility.
 *
 * Deletes all demo data for a given user ID in correct FK order.
 */
import { db } from "@pause/db";
import {
  card,
  ghostCard,
  interaction,
  savings,
  skillbook,
  user,
} from "@pause/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Deletes all demo data for the given user ID.
 *
 * Deletes in FK order to avoid constraint violations:
 * 1. ghostCard (has userId)
 * 2. savings (via interactionId subquery — no userId column)
 * 3. interaction (has userId)
 * 4. card (has userId)
 * 5. skillbook (has userId)
 * 6. user
 *
 * Handles "user not found" gracefully (no-op).
 */
export async function cleanDemoData(userId: string): Promise<void> {
  // Check if user exists first
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (existing.length === 0) {
    return;
  }

  // 1. Delete ghost cards (has userId)
  await db.delete(ghostCard).where(eq(ghostCard.userId, userId));

  // 2. Delete savings (no userId — delete via interactionId subquery)
  const userInteractionIds = db
    .select({ id: interaction.id })
    .from(interaction)
    .where(eq(interaction.userId, userId));
  await db
    .delete(savings)
    .where(inArray(savings.interactionId, userInteractionIds));

  // 3. Delete interactions
  await db.delete(interaction).where(eq(interaction.userId, userId));

  // 4. Delete cards
  await db.delete(card).where(eq(card.userId, userId));

  // 5. Delete skillbook
  await db.delete(skillbook).where(eq(skillbook.userId, userId));

  // 6. Delete user
  await db.delete(user).where(eq(user.id, userId));
}
