import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { ghostCard } from "@pause/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import z from "zod";
import { runSatisfactionFeedbackLearning } from "@/lib/server/learning";
import {
  attachFeedbackScoreToTrace,
  REGRET_FREE_SCORES,
} from "@/lib/server/opik";
import { withTimeout } from "@/lib/server/utils";

export const runtime = "nodejs";

const DB_TIMEOUT_MS = 10_000;

const patchSchema = z.object({
  satisfactionFeedback: z.enum(["worth_it", "regret_it", "not_sure"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // --- Auth check ---
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Request validation ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // --- Lookup ghost card ---
  const { id } = await params;
  let existing:
    | { id: string; userId: string; interactionId: string }
    | undefined;
  try {
    const result = await withTimeout(
      db
        .select({
          id: ghostCard.id,
          userId: ghostCard.userId,
          interactionId: ghostCard.interactionId,
        })
        .from(ghostCard)
        .where(eq(ghostCard.id, id))
        .limit(1),
      DB_TIMEOUT_MS
    );
    existing = result[0];
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  // --- 404: Ghost card not found ---
  if (!existing) {
    return Response.json({ error: "Ghost card not found" }, { status: 404 });
  }

  // --- 403: Ownership check ---
  if (existing.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Update satisfaction feedback + status ---
  try {
    await withTimeout(
      db
        .update(ghostCard)
        .set({
          satisfactionFeedback: parsed.data.satisfactionFeedback,
          status: "feedback_given",
        })
        .where(eq(ghostCard.id, id)),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json(
      { error: "Failed to update ghost card" },
      { status: 500 }
    );
  }

  // --- Attach Opik regret-free score (Story 8.3) — fire-and-forget ---
  const regretScore = REGRET_FREE_SCORES[parsed.data.satisfactionFeedback];
  if (regretScore) {
    attachFeedbackScoreToTrace(
      existing.interactionId,
      "regret_free_spending",
      regretScore.value,
      regretScore.reason
    ).catch((error) => {
      console.warn(
        `[Opik] Regret-free score attachment failed for ${id}:`,
        error
      );
    });
  } else if (parsed.data.satisfactionFeedback === "not_sure") {
    console.info(
      "[Opik] Skipping regret_free_spending score for not_sure feedback"
    );
  }

  // --- Trigger satisfaction learning pipeline (Story 6.6, AC1/6/7) ---
  after(() =>
    runSatisfactionFeedbackLearning({
      ghostCardId: id,
      userId: session.user.id,
      satisfactionFeedback: parsed.data.satisfactionFeedback,
    }).catch((error) => {
      console.warn(
        `[SatisfactionLearning] after() callback failed for ${id}:`,
        error
      );
    })
  );

  return Response.json({
    success: true,
    ghostCardId: id,
    satisfactionFeedback: parsed.data.satisfactionFeedback,
  });
}
