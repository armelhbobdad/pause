import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { interaction } from "@pause/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import z from "zod";
import {
  attachFeedbackScoreToTrace,
  INTERVENTION_ACCEPTANCE_SCORES,
} from "@/lib/server/opik";
import { withTimeout } from "@/lib/server/utils";

export const runtime = "nodejs";

const DB_TIMEOUT_MS = 10_000;

const wizardResponseSchema = z.object({
  step: z.number(),
  question: z.string(),
  answer: z.string(),
});

const requestSchema = z.object({
  interactionId: z.string().min(1),
  responses: z.array(wizardResponseSchema).min(1),
  outcome: z.enum(["wait", "override", "wizard_bookmark"]),
});

export async function POST(req: Request) {
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { interactionId, responses, outcome: rawOutcome } = parsed.data;

  // Map client-facing outcome names to DB enum values
  const outcomeMap = {
    wait: "wait",
    override: "overridden",
    wizard_bookmark: "wizard_bookmark",
  } as const;
  const outcome = outcomeMap[rawOutcome];

  // --- Verify interaction exists, belongs to user, and outcome is null ---
  let existingInteraction:
    | {
        id: string;
        userId: string;
        status: string;
        outcome: string | null;
      }
    | undefined;
  try {
    const result = await withTimeout(
      db
        .select({
          id: interaction.id,
          userId: interaction.userId,
          status: interaction.status,
          outcome: interaction.outcome,
        })
        .from(interaction)
        .where(eq(interaction.id, interactionId))
        .limit(1),
      DB_TIMEOUT_MS
    );
    existingInteraction = result[0];
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  if (!existingInteraction) {
    return Response.json({ error: "Interaction not found" }, { status: 404 });
  }

  if (existingInteraction.userId !== session.user.id) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  // Idempotency guard: reject if outcome is already set
  if (existingInteraction.outcome !== null) {
    return Response.json(
      { error: "Interaction already has an outcome" },
      { status: 409 }
    );
  }

  // --- Update interaction outcome with wizard responses in metadata ---
  try {
    await withTimeout(
      db
        .update(interaction)
        .set({
          outcome,
          status: "feedback_received",
          metadata: { wizardResponses: responses },
        })
        .where(
          and(eq(interaction.id, interactionId), isNull(interaction.outcome))
        ),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json(
      { error: "Failed to update interaction" },
      { status: 500 }
    );
  }

  // --- Attach Opik feedback score (Story 8.3) — fire-and-forget ---
  const scoreEntry = INTERVENTION_ACCEPTANCE_SCORES[rawOutcome];
  if (scoreEntry) {
    attachFeedbackScoreToTrace(
      interactionId,
      "intervention_acceptance",
      scoreEntry.value,
      scoreEntry.reason
    ).catch((error) => {
      console.warn(
        `[Opik] Score attachment failed for ${interactionId}:`,
        error
      );
    });
  }

  return Response.json({ success: true });
}
