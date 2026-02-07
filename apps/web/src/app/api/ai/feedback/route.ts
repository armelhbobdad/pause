import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { interaction } from "@pause/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import z from "zod";
import {
  attachReflectionToTrace,
  markLearningComplete,
  runReflection,
  runSkillUpdate,
} from "@/lib/server/learning";
import { withTimeout } from "@/lib/server/utils";

export const runtime = "nodejs";

const DB_TIMEOUT_MS = 10_000;

const clientOutcomes = [
  "accepted",
  "override",
  "wait",
  "abandoned",
  "skipped_savings",
  "accepted_savings",
] as const;

/** Maps client-facing outcome strings to DB enum values */
const outcomeMap = {
  accepted: "accepted",
  override: "overridden",
  wait: "wait",
  abandoned: "abandoned",
  skipped_savings: "overridden",
  accepted_savings: "accepted",
} as const satisfies Record<(typeof clientOutcomes)[number], string>;

const requestSchema = z.object({
  interactionId: z.string().min(1),
  outcome: z.enum(clientOutcomes),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Outcomes that represent meaningful user behavioral signals for learning.
 * Note: wizard_bookmark/wizard_abandoned flow through the wizard route directly,
 * not via this feedback route — they'll need their own learning trigger. */
const LEARNABLE_OUTCOMES = ["accepted", "overridden", "wait", "abandoned"];

/** Runs the learning pipeline stages after feedback is recorded (Story 6.2, 6.3) */
async function runLearningPipeline(params: {
  interactionId: string;
  userId: string;
  metadata: unknown;
  reasoningSummary: string | null;
  outcome: string;
}) {
  const meta = (params.metadata ?? {}) as Record<string, unknown>;
  const purchaseCtx =
    typeof meta.purchaseContext === "string"
      ? meta.purchaseContext
      : "unlock request";

  const result = await runReflection({
    interactionId: params.interactionId,
    userId: params.userId,
    question: purchaseCtx,
    generatorAnswer: params.reasoningSummary ?? "",
    outcome: params.outcome,
  });

  if (!result) {
    return;
  }

  // Story 6.3: Run SkillManager curation + persist (sequential — must complete before traces)
  await runSkillUpdate(result);

  // Opik trace attachment and status update run independently via Promise.allSettled
  const [opikResult, statusResult] = await Promise.allSettled([
    attachReflectionToTrace(params.interactionId, result.reflectionOutput),
    markLearningComplete(params.interactionId),
  ]);

  if (opikResult.status === "rejected") {
    console.warn(
      `[Feedback] Opik trace attachment failed for ${params.interactionId}:`,
      opikResult.reason
    );
  }
  if (statusResult.status === "rejected") {
    console.warn(
      `[Feedback] Status update failed for ${params.interactionId}:`,
      statusResult.reason
    );
  }
}

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

  // --- Lookup interaction ---
  let existingInteraction:
    | {
        id: string;
        userId: string;
        status: string;
        outcome: string | null;
        metadata: unknown;
        reasoningSummary: string | null;
        tier: string;
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
          metadata: interaction.metadata,
          reasoningSummary: interaction.reasoningSummary,
          tier: interaction.tier,
        })
        .from(interaction)
        .where(eq(interaction.id, parsed.data.interactionId))
        .limit(1),
      DB_TIMEOUT_MS
    );
    existingInteraction = result[0];
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  // --- 404: Interaction not found ---
  if (!existingInteraction) {
    return Response.json({ error: "Interaction not found" }, { status: 404 });
  }

  // --- 403: Authorization guard ---
  if (existingInteraction.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Map outcome ---
  const mappedOutcome = outcomeMap[parsed.data.outcome];

  // --- Merge metadata ---
  const incomingMetadata = parsed.data.metadata;
  const hasIncomingMetadata =
    incomingMetadata && Object.keys(incomingMetadata).length > 0;
  const existingMeta = (existingInteraction.metadata ?? {}) as Record<
    string,
    unknown
  >;
  const mergedMetadata = hasIncomingMetadata
    ? { ...existingMeta, ...incomingMetadata }
    : existingInteraction.metadata;

  // --- Detect upsert (outcome already existed) ---
  const isUpdate = existingInteraction.outcome !== null;

  // --- Update interaction ---
  try {
    await withTimeout(
      db
        .update(interaction)
        .set({
          outcome: mappedOutcome,
          status: "feedback_received",
          metadata: mergedMetadata,
        })
        .where(eq(interaction.id, parsed.data.interactionId)),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json(
      { error: "Failed to update interaction" },
      { status: 500 }
    );
  }

  // --- Trigger learning pipeline in after() callback (Story 6.2) ---
  const interactionId = parsed.data.interactionId;
  if (LEARNABLE_OUTCOMES.includes(mappedOutcome)) {
    after(() =>
      runLearningPipeline({
        interactionId,
        userId: session.user.id,
        metadata: existingInteraction.metadata,
        reasoningSummary: existingInteraction.reasoningSummary,
        outcome: mappedOutcome,
      })
    );
  }

  // --- Success response ---
  if (isUpdate) {
    return Response.json({
      success: true,
      feedbackId: parsed.data.interactionId,
      updated: true,
    });
  }

  return Response.json({
    success: true,
    feedbackId: parsed.data.interactionId,
  });
}
