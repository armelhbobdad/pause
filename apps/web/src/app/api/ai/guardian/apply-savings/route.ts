import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { interaction, savings } from "@pause/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import z from "zod";
import { withTimeout } from "@/lib/server/utils";

export const runtime = "nodejs";

const DB_TIMEOUT_MS = 10_000;

const requestSchema = z.object({
  interactionId: z.string().min(1),
  couponCode: z.string().optional(),
  amountCents: z.number().int().min(0),
  source: z.string().min(1),
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
  const { interactionId, couponCode, amountCents, source } = parsed.data;

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
    return Response.json({ error: "Interaction not found" }, { status: 403 });
  }

  if (existingInteraction.userId !== session.user.id) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  // Status guard: allow apply on pending (stream still finishing) or completed
  if (
    existingInteraction.status !== "completed" &&
    existingInteraction.status !== "pending"
  ) {
    return Response.json(
      { error: "Interaction not in valid state" },
      { status: 409 }
    );
  }

  // Idempotency guard: reject if outcome is already set
  if (existingInteraction.outcome !== null) {
    return Response.json(
      { error: "Interaction already has an outcome" },
      { status: 409 }
    );
  }

  // --- Insert savings record and update interaction ---
  // Sequential queries (neon-http driver does not support transactions)
  try {
    await withTimeout(
      db.insert(savings).values({
        id: crypto.randomUUID(),
        interactionId,
        amountCents,
        couponCode: couponCode ?? null,
        source,
        applied: true,
      }),
      DB_TIMEOUT_MS
    );
    await withTimeout(
      db
        .update(interaction)
        .set({
          outcome: "accepted",
          status: "feedback_received",
        })
        .where(
          and(eq(interaction.id, interactionId), isNull(interaction.outcome))
        ),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json({ error: "Failed to apply savings" }, { status: 500 });
  }

  return Response.json({ success: true });
}
