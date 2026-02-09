import { google } from "@ai-sdk/google";
import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { card, interaction } from "@pause/db/schema";
import { env } from "@pause/env/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import z from "zod";
import { TOOL_NAMES } from "@/lib/guardian/tool-names";
import {
  loadUserSkillbookInstance,
  wrapSkillbookContext,
} from "@/lib/server/ace";
import { createBannedTermFilter } from "@/lib/server/guardian/filters";
import { ANALYST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/analyst";
import { NEGOTIATOR_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/negotiator";
import { THERAPIST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/therapist";
import { assessRisk } from "@/lib/server/guardian/risk";
import {
  determineTier,
  type InteractionTier,
} from "@/lib/server/guardian/tiers";
import { searchCouponsTool } from "@/lib/server/guardian/tools/coupon-search";
import { presentReflectionTool } from "@/lib/server/guardian/tools/reflection-prompt";
import { showWaitOptionTool } from "@/lib/server/guardian/tools/wait-option";
import { presentWizardOptionTool } from "@/lib/server/guardian/tools/wizard-option";

import {
  buildReasoningSummary,
  getGuardianTelemetry,
  logDegradationTrace,
  writeTraceMetadata,
} from "@/lib/server/opik";
import { predictNextStrategy } from "@/lib/server/strategy-prediction";

import { withTimeout } from "@/lib/server/utils";

const TIER_PROMPTS: Record<InteractionTier, string> = {
  analyst: ANALYST_SYSTEM_PROMPT,
  negotiator: NEGOTIATOR_SYSTEM_PROMPT,
  therapist: THERAPIST_SYSTEM_PROMPT,
};

const MAX_CONTEXT_CHARS = 8000;

function truncateContext(context: string): string {
  if (context.length <= MAX_CONTEXT_CHARS) {
    return context;
  }
  return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n[Skillbook truncated - showing top strategies]`;
}

export const runtime = "nodejs";
export const maxDuration = 30;

const DB_TIMEOUT_MS = 10_000;

function getDemoStreamOptions(): { temperature?: number; seed?: number } {
  if (env.DEMO_MODE === "true") {
    return { temperature: 0, seed: 42 };
  }
  return {};
}

function buildPrepareStep(
  tier: InteractionTier,
  riskScore: number
): () => Record<string, unknown> {
  return () => {
    if (tier === "negotiator") {
      return {
        toolCallStreaming: true,
        activeTools: [TOOL_NAMES.SEARCH_COUPONS],
      };
    }
    if (tier === "therapist") {
      const activeTools: import("@/lib/guardian/tool-names").ToolName[] = [
        TOOL_NAMES.PRESENT_REFLECTION,
        TOOL_NAMES.SHOW_WAIT_OPTION,
      ];
      if (riskScore >= 85) {
        activeTools.push(TOOL_NAMES.PRESENT_WIZARD_OPTION);
      }
      return { toolCallStreaming: true, activeTools };
    }
    return {};
  };
}

const requestSchema = z.object({
  messages: z
    .array(
      z
        .object({ role: z.enum(["user", "assistant", "system", "tool"]) })
        .passthrough()
    )
    .min(1),
  cardId: z.string().min(1),
  purchaseContext: z.string().max(500).optional(),
});

// Extract purchase text from a message object. Handles both UIMessage v6
// `parts` array and legacy `content` string formats.
function extractFirstUserText(
  msg: Record<string, unknown>
): string | undefined {
  if (typeof msg.content === "string" && msg.content.trim()) {
    return msg.content.trim().slice(0, 500);
  }
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim().slice(0, 500);
      }
    }
  }
  return undefined;
}

// Resolve purchaseContext: prefer explicit body field, fall back to first user message text.
// The client sends the purchase description as the first chat message, not as a
// separate body field, so we extract it here for risk assessment + model context.
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown stream failure";
}

// Write degradation outcome to DB after stream failure.
async function writeDegradationOutcome(
  interactionId: string,
  outcome: "auto_approved" | "break_glass",
  failureReason: string
): Promise<void> {
  try {
    const label = outcome === "auto_approved" ? "analyst_only" : "break_glass";
    await db
      .update(interaction)
      .set({
        status: "completed",
        outcome,
        reasoningSummary: `System failure — ${label} fallback activated. Reason: ${failureReason}`,
      })
      .where(eq(interaction.id, interactionId));
  } catch (updateError) {
    console.error(
      `[Guardian] Failed to update degraded interaction ${interactionId}:`,
      updateError
    );
  }
}

function resolvePurchaseContext(
  explicitContext: string | undefined,
  messages: Record<string, unknown>[]
): string | undefined {
  if (explicitContext) {
    return explicitContext;
  }
  const firstUserMsg = messages.find((m) => m.role === "user") as
    | Record<string, unknown>
    | undefined;
  if (!firstUserMsg) {
    return undefined;
  }
  return extractFirstUserText(firstUserMsg);
}

export async function POST(req: Request) {
  // Service health tracking — scaffold for Story 3.6 degradation ladder.
  // Flags are set in catch blocks; Story 3.6 will read them for tier fallback.
  const serviceHealth = { gemini: true, opik: true, neon: true, ace: true };

  // --- Auth check (AC#2) ---
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // --- Request validation (AC#1) ---
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }
  const { messages, cardId } = parsed.data;

  const purchaseContext = resolvePurchaseContext(
    parsed.data.purchaseContext,
    messages as unknown as Record<string, unknown>[]
  );

  // --- Authorization: verify card ownership (AC#3) ---
  let userCard: { id: string; userId: string } | undefined;
  try {
    const result = await withTimeout(
      db
        .select({ id: card.id, userId: card.userId })
        .from(card)
        .where(and(eq(card.id, cardId), eq(card.userId, session.user.id)))
        .limit(1),
      DB_TIMEOUT_MS
    );
    userCard = result[0];
  } catch {
    serviceHealth.neon = false;
    return new Response("Database error", { status: 500 });
  }

  if (!userCard) {
    return new Response("Card not found or access denied", { status: 403 });
  }

  // --- Generate interactionId (AC#7, ADR-007) ---
  const interactionId = crypto.randomUUID();

  // --- Risk assessment (Story 3.2, AC#10) ---
  let riskResult: {
    score: number;
    reasoning: string;
    historyAvailable: boolean;
  };
  try {
    riskResult = await assessRisk({
      userId: session.user.id,
      cardId,
      purchaseContext,
    });
  } catch {
    riskResult = {
      score: 0,
      reasoning: "Risk assessment unavailable",
      historyAvailable: false,
    };
  }
  if (!riskResult.historyAvailable) {
    serviceHealth.neon = false;
  }

  // --- Tier determination (Story 3.3, AC#10) ---
  const tier = determineTier(riskResult.score);

  // --- Auto-approve detection (Story 3.5) ---
  const isAutoApproved = tier === "analyst";

  // --- Skeleton interaction write (AC#9, ADR-006) ---
  try {
    await withTimeout(
      db.insert(interaction).values({
        id: interactionId,
        userId: session.user.id,
        cardId,
        tier,
        riskScore: riskResult.score,
        status: "pending",
        outcome: null,
        metadata: purchaseContext ? { purchaseContext } : null,
      }),
      DB_TIMEOUT_MS
    );
  } catch {
    serviceHealth.neon = false;
    return new Response("Failed to create interaction record", { status: 500 });
  }

  // --- Load Skillbook context + instance (Story 3.4, Story 8.4) ---
  let skillbookContext = "";
  let skillbookInstance: import("@pause/ace").Skillbook | null = null;
  try {
    const loaded = await loadUserSkillbookInstance(session.user.id);
    skillbookInstance = loaded.skillbook;
    skillbookContext = truncateContext(wrapSkillbookContext(skillbookInstance));
  } catch (error) {
    console.warn(
      "[Guardian] Skillbook loading failed, continuing without context:",
      error
    );
    serviceHealth.ace = false;
  }

  // --- Build tier-aware system prompt (Story 3.3, AC#1, #2, #3, #4) ---
  const tierPrompt = TIER_PROMPTS[tier];
  const systemPrompt = skillbookContext
    ? `${tierPrompt}\n\n${skillbookContext}`
    : tierPrompt;

  // --- Stream response (AC#5, #6, #8, #11, #14, #15) ---
  // purchaseContext is prepended to model messages (not system prompt) to prevent
  // user-supplied text from being interpreted as system-level instructions.
  const modelMessages = await convertToModelMessages(
    messages as unknown as UIMessage[]
  );
  if (purchaseContext) {
    modelMessages.unshift({
      role: "user",
      content: `[Purchase context: ${purchaseContext}]`,
    });
  }

  // --- Strategy prediction (Story 8.4) ---
  const prediction = predictNextStrategy({
    tier,
    skillbook: skillbookInstance,
  });

  // --- Banned terminology guardrail (Story 5.4, AC#3, #4, #7) ---
  const bannedTermReplacements: Array<{
    original: string;
    replacement: string | null;
  }> = [];

  try {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: modelMessages,
      ...getDemoStreamOptions(),
      tools: {
        [TOOL_NAMES.SEARCH_COUPONS]: searchCouponsTool,
        [TOOL_NAMES.PRESENT_REFLECTION]: presentReflectionTool,
        [TOOL_NAMES.SHOW_WAIT_OPTION]: showWaitOptionTool,
        [TOOL_NAMES.PRESENT_WIZARD_OPTION]: presentWizardOptionTool,
      },
      prepareStep: buildPrepareStep(tier, riskResult.score),
      stopWhen: stepCountIs(isAutoApproved ? 1 : 5),
      experimental_transform: createBannedTermFilter((replacements) => {
        bannedTermReplacements.push(...replacements);
      }),
      experimental_telemetry: getGuardianTelemetry(
        interactionId,
        {
          score: riskResult.score,
          reasoning: riskResult.reasoning,
        },
        tier,
        isAutoApproved,
        undefined,
        undefined,
        purchaseContext,
        prediction
      ),
      // Analyst auto-approves in ~1s; negotiator/therapist need multi-step tool calls
      abortSignal: AbortSignal.timeout(isAutoApproved ? 10_000 : 25_000),
    });

    // --- after() callback for interaction completion (AC#9, #15, Task 4) ---
    after(async () => {
      try {
        // Wait for stream to finish — if it errored, leave status as "pending"
        let completedText: string;
        try {
          completedText = await result.text;
        } catch {
          console.error(
            `[Guardian] Stream failed for interaction ${interactionId}, status left as pending`
          );
          return;
        }

        // --- Banned term replacement logging (Story 5.4, AC#4, FR46) ---
        if (bannedTermReplacements.length > 0) {
          console.warn(
            `[Guardian] Banned term replaced in interaction ${interactionId}`
          );
        }

        // Build tier-aware reasoning summary for DB and Opik (NFR-O2, FR32)
        const reasoningSummary = buildReasoningSummary({
          tier,
          riskScore: riskResult.score,
          purchaseContext,
          outcome: isAutoApproved ? "auto_approved" : undefined,
          completedText: isAutoApproved ? undefined : completedText,
          isAutoApproved,
        });

        // Write reasoning summary + structured metadata to Opik trace (Story 8.2, AC#8)
        writeTraceMetadata(interactionId, {
          reasoning_summary: reasoningSummary,
          tier,
          risk_score: riskResult.score,
          purchase_context: purchaseContext,
          outcome: isAutoApproved ? "auto_approved" : "pending",
        });

        await db
          .update(interaction)
          .set({
            status: "completed",
            ...(isAutoApproved && { outcome: "auto_approved" }),
            reasoningSummary,
            ...(bannedTermReplacements.length > 0 && {
              metadata: {
                ...(purchaseContext ? { purchaseContext } : {}),
                banned_terms_replaced: bannedTermReplacements.map((r) => ({
                  original: r.original,
                  replacement: r.replacement,
                })),
              },
            }),
          })
          .where(eq(interaction.id, interactionId));
      } catch (error) {
        console.error(
          `[Guardian] Failed to update interaction ${interactionId}:`,
          error
        );
        // after() errors MUST be caught and logged, never re-thrown (ADR-006)
      }
    });

    // --- Return stream with interactionId header (AC#10) ---
    const response = result.toUIMessageStreamResponse();

    // Clone to add custom headers
    const headers2 = new Headers(response.headers);
    // Client uses x-interaction-id to submit feedback via /api/ai/feedback (Epic 6)
    headers2.set("x-interaction-id", interactionId);
    headers2.set("x-guardian-tier", tier);
    if (isAutoApproved) {
      headers2.set("x-guardian-auto-approved", "true");
    }

    return new Response(response.body, {
      status: response.status,
      headers: headers2,
    });
  } catch (error) {
    serviceHealth.gemini = false;
    const failureReason = getErrorMessage(error);
    console.error(
      `[Guardian] Degradation activated for ${interactionId}: tier=${tier}, reason=${failureReason}`
    );

    // --- Degradation telemetry (Story 3.6, AC#2, AC#4; Story 8.4) ---
    logDegradationTrace(
      interactionId,
      tier === "analyst" ? "analyst_only" : "break_glass",
      failureReason,
      { score: riskResult.score, reasoning: riskResult.reasoning },
      tier,
      prediction
    );

    // --- Degradation Ladder (Story 3.6) ---
    // Level 1: Analyst-only fallback — risk assessment already completed
    if (tier === "analyst") {
      after(() =>
        writeDegradationOutcome(interactionId, "auto_approved", failureReason)
      );

      return new Response("Looks good! Card unlocked.", {
        headers: {
          "x-interaction-id": interactionId,
          "x-guardian-tier": tier,
          "x-guardian-auto-approved": "true",
          "x-guardian-degraded": "true",
        },
      });
    }

    // Level 2: Break Glass — non-analyst tiers or risk assessment failed
    after(() =>
      writeDegradationOutcome(interactionId, "break_glass", failureReason)
    );

    return new Response("", {
      headers: {
        "x-interaction-id": interactionId,
        "x-guardian-tier": tier,
        "x-guardian-break-glass": "true",
      },
    });
  }
}
