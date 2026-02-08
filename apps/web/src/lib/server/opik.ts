import "server-only";
import type { TelemetrySettings } from "ai";
import { Opik } from "opik";
import { OpikExporter } from "opik-vercel";
import { TRACE_NAMES } from "@/lib/guardian/trace-names";
import type { PredictedStrategy } from "@/lib/server/strategy-prediction";

/**
 * Banned clinical terms and their safe replacements for reasoning summaries (NFR-T6).
 * Scanned case-insensitively; null replacements cause the word to be removed.
 */
const BANNED_SUMMARY_TERMS: Record<string, string> = {
  therapy: "reflection",
  therapist: "high-risk",
  diagnosis: "assessment",
  patient: "user",
  treatment: "approach",
  clinical: "structured",
  session: "interaction",
};

// Re-export Opik class for direct client creation
// biome-ignore lint/performance/noBarrelFile: Server-only re-export for Guardian infrastructure, not a barrel file
export { Opik } from "opik";

// Lazy-initialized singleton Opik client
let opikClient: Opik | null = null;

/**
 * Returns the singleton Opik client instance.
 * Creates the client lazily on first call using environment configuration.
 *
 * Uses OPIK_API_KEY and OPIK_PROJECT_NAME from environment variables.
 * Returns null if OPIK_API_KEY is not configured (development mode).
 */
export function getOpikClient(): Opik | null {
  if (opikClient) {
    return opikClient;
  }

  const apiKey = process.env.OPIK_API_KEY;
  if (!apiKey) {
    return null;
  }

  opikClient = new Opik({
    apiKey,
    projectName: process.env.OPIK_PROJECT_NAME ?? "pause",
  });

  return opikClient;
}

/**
 * Replaces banned clinical terminology in a summary string (NFR-T6).
 */
function sanitizeBannedTerms(text: string): string {
  let result = text;
  for (const [term, replacement] of Object.entries(BANNED_SUMMARY_TERMS)) {
    const pattern = new RegExp(`\\b${term}\\b`, "gi");
    result = result.replace(pattern, replacement);
  }
  return result;
}

const MAX_SUMMARY_LENGTH = 500;
const COUPON_REGEX = /(\d+%?\s*(?:off|coupon|discount|savings?))/i;
const SENTENCE_SPLIT_REGEX = /[.!?\n]/;

/**
 * Input params for building a reasoning summary.
 */
export interface ReasoningSummaryInput {
  tier: string;
  riskScore: number;
  purchaseContext?: string;
  outcome?: string;
  completedText?: string;
  isAutoApproved?: boolean;
  degraded?: { level: "analyst_only" | "break_glass"; reason: string };
}

/**
 * Builds the raw summary string for a specific tier before sanitization.
 */
function buildRawSummary(input: ReasoningSummaryInput): string {
  const {
    tier,
    riskScore,
    purchaseContext,
    outcome,
    completedText,
    isAutoApproved,
    degraded,
  } = input;
  const context = purchaseContext
    ? ` Purchase context: ${purchaseContext}.`
    : "";

  if (degraded) {
    const tierLabel = tier ?? "unknown";
    const reasonSuffix = degraded.reason ? ` Reason: ${degraded.reason}.` : "";
    return `System failure during ${tierLabel} intervention (score: ${riskScore}). Fallback to ${degraded.level}.${reasonSuffix}`;
  }

  if (isAutoApproved || tier === "analyst") {
    return `Low-risk unlock request (score: ${riskScore}).${context} Auto-approved without intervention.`;
  }

  if (tier === "negotiator") {
    const action = extractNegotiatorAction(completedText);
    const outcomeDesc = describeOutcome(outcome);
    return `Medium-risk unlock (score: ${riskScore}).${action ? ` ${action}.` : ""}${outcomeDesc ? ` ${outcomeDesc}.` : ""}`;
  }

  if (tier === "therapist") {
    const strategy = extractTherapistStrategy(completedText);
    const outcomeDesc = describeOutcome(outcome);
    return `High-risk unlock (score: ${riskScore}).${strategy ? ` ${strategy}.` : ""}${outcomeDesc ? ` ${outcomeDesc}.` : ""}`;
  }

  return `Guardian interaction (score: ${riskScore}, tier: ${tier ?? "unknown"}).${context}`;
}

/**
 * Builds a human-readable reasoning summary for Opik trace metadata (FR32, NFR-O2).
 * Returns a 1-3 sentence summary in objective professional language.
 * All banned clinical terms are replaced with safe alternatives (NFR-T6).
 */
export function buildReasoningSummary(input: ReasoningSummaryInput): string {
  let summary = sanitizeBannedTerms(buildRawSummary(input));

  if (summary.length > MAX_SUMMARY_LENGTH) {
    const spaceIdx = summary.lastIndexOf(" ", MAX_SUMMARY_LENGTH);
    summary = `${summary.slice(0, spaceIdx === -1 ? MAX_SUMMARY_LENGTH : spaceIdx)}...`;
  }

  return summary;
}

/**
 * Extracts a key action description from negotiator completedText.
 * Looks for coupon/savings mentions.
 */
function extractNegotiatorAction(text?: string): string {
  if (!text) {
    return "";
  }
  const couponMatch = text.match(COUPON_REGEX);
  if (couponMatch) {
    return `Found ${couponMatch[1]}`;
  }
  // Fallback: first sentence, truncated
  const firstSentence = text.split(SENTENCE_SPLIT_REGEX)[0]?.trim();
  if (firstSentence && firstSentence.length <= 120) {
    return firstSentence;
  }
  if (firstSentence) {
    const spaceIdx = firstSentence.lastIndexOf(" ", 120);
    return `${firstSentence.slice(0, spaceIdx === -1 ? 120 : spaceIdx)}...`;
  }
  return "";
}

/**
 * Extracts the strategy used from therapist completedText.
 * Looks for known strategy patterns.
 */
function extractTherapistStrategy(text?: string): string {
  if (!text) {
    return "";
  }
  const strategies = [
    "future-self visualization",
    "future self visualization",
    "cooling-off",
    "reflection",
    "waiting period",
    "spending pattern",
    "values alignment",
    "needs vs wants",
  ];
  const lower = text.toLowerCase();
  for (const strategy of strategies) {
    if (lower.includes(strategy)) {
      return `Applied ${strategy} strategy`;
    }
  }
  // Fallback: first sentence, truncated
  const firstSentence = text.split(SENTENCE_SPLIT_REGEX)[0]?.trim();
  if (firstSentence && firstSentence.length <= 120) {
    return firstSentence;
  }
  if (firstSentence) {
    const spaceIdx = firstSentence.lastIndexOf(" ", 120);
    return `${firstSentence.slice(0, spaceIdx === -1 ? 120 : spaceIdx)}...`;
  }
  return "";
}

/**
 * Maps outcome codes to human-readable descriptions.
 */
function describeOutcome(outcome?: string): string {
  if (!outcome) {
    return "";
  }
  const map: Record<string, string> = {
    accepted: "User accepted the suggestion",
    accepted_savings: "User accepted savings",
    skipped_savings: "User skipped savings",
    override: "User overrode the suggestion",
    overridden: "User overrode the suggestion",
    wait: "User chose to wait",
    abandoned: "User abandoned the interaction",
    wizard_bookmark: "User bookmarked reflection for later",
    wizard_abandoned: "User abandoned the reflection wizard",
    auto_approved: "Auto-approved without intervention",
    break_glass: "System fallback activated",
    timeout: "Interaction timed out",
  };
  return map[outcome] ?? "";
}

/**
 * Writes reasoning summary and structured metadata to an existing Opik trace.
 * Searches for the trace by metadata.interactionId, then updates it.
 * Fire-and-forget: errors are silently caught.
 */
export async function writeTraceMetadata(
  interactionId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const client = getOpikClient();
    if (!client) {
      return;
    }

    const traces = await client.searchTraces({
      filterString: `metadata.interactionId = "${interactionId}"`,
      maxResults: 1,
    });

    if (traces.length > 0) {
      // Create a child trace with the metadata since we can't update trace metadata directly
      const metadataTrace = client.trace({
        name: "guardian:metadata_update",
        input: {
          interactionId,
          parentTraceId: traces[0].id,
          ...metadata,
        },
      });
      metadataTrace.end();
      await client.flush();
    }
  } catch {
    // Telemetry failures must never disrupt the main flow
  }
}

/**
 * Resolve the TRACE_NAMES constant key for a given tier and outcome.
 * Returns a human-readable, filterable trace name from the TRACE_NAMES constant.
 *
 * When outcome is not yet known (streaming in progress), returns a tier-prefixed
 * fallback name using the interactionId for uniqueness.
 */
function resolveTraceName(
  interactionId: string,
  tier?: string,
  outcome?: string,
  autoApproved?: boolean,
  degraded?: { level: "analyst_only" | "break_glass"; reason: string }
): string {
  if (degraded) {
    return degraded.level === "analyst_only"
      ? TRACE_NAMES.SYSTEM_FAILURE_ANALYST_ONLY
      : TRACE_NAMES.SYSTEM_FAILURE_BREAK_GLASS;
  }

  if (autoApproved) {
    return TRACE_NAMES.ANALYST_AUTO_APPROVED;
  }

  // Outcome-based naming when outcome is known
  if (outcome && tier) {
    const key = `${tier}:${outcome}`;
    const outcomeMap: Record<string, string> = {
      "negotiator:accepted_savings": TRACE_NAMES.NEGOTIATOR_ACCEPTED_SAVINGS,
      "negotiator:skipped_savings": TRACE_NAMES.NEGOTIATOR_SKIPPED_SAVINGS,
      "negotiator:accepted": TRACE_NAMES.NEGOTIATOR_ACCEPTED,
      "negotiator:override": TRACE_NAMES.NEGOTIATOR_OVERRIDE,
      "therapist:wait": TRACE_NAMES.THERAPIST_WAIT,
      "therapist:accepted": TRACE_NAMES.THERAPIST_ACCEPTED,
      "therapist:override": TRACE_NAMES.THERAPIST_OVERRIDE,
      "therapist:wizard_bookmark": TRACE_NAMES.THERAPIST_WIZARD_BOOKMARK,
      "therapist:wizard_abandoned": TRACE_NAMES.THERAPIST_WIZARD_ABANDONED,
    };

    if (outcomeMap[key]) {
      return outcomeMap[key];
    }
  }

  // Tier-prefixed fallback for streaming (outcome not yet known)
  if (tier) {
    return `guardian:${tier}:${interactionId}`;
  }

  return `guardian:unknown:${interactionId}`;
}

export async function logDegradationTrace(
  interactionId: string,
  degradationLevel: "analyst_only" | "break_glass",
  failureReason: string,
  riskMeta?: { score: number; reasoning: string },
  tier?: string,
  prediction?: PredictedStrategy
): Promise<void> {
  try {
    const client = getOpikClient();
    if (!client) {
      return;
    }

    const traceName =
      degradationLevel === "analyst_only"
        ? TRACE_NAMES.SYSTEM_FAILURE_ANALYST_ONLY
        : TRACE_NAMES.SYSTEM_FAILURE_BREAK_GLASS;

    const reasoningSummary = buildReasoningSummary({
      tier: tier ?? "unknown",
      riskScore: riskMeta?.score ?? 0,
      degraded: { level: degradationLevel, reason: failureReason },
    });

    const trace = client.trace({
      name: traceName,
      input: {
        interactionId,
        tier,
        failureReason,
        degraded: true,
        degradationLevel,
        reasoning_summary: reasoningSummary,
        ...(riskMeta && {
          riskScore: riskMeta.score,
          riskReasoning: riskMeta.reasoning,
        }),
        ...(prediction && { predicted_next_strategy: prediction }),
      },
    });
    trace.end();
    await client.flush();
  } catch {
    // Telemetry failures must never disrupt the degradation response
  }
}

/** Maps client-facing intervention outcomes to Opik feedback scores */
export const INTERVENTION_ACCEPTANCE_SCORES: Record<
  string,
  { value: number; reason: string }
> = {
  accepted: { value: 1.0, reason: "User accepted Guardian suggestion" },
  accepted_savings: { value: 1.0, reason: "User accepted savings offer" },
  wait: { value: 1.0, reason: "User chose to wait as suggested" },
  skipped_savings: {
    value: 0.5,
    reason: "User skipped savings but accepted unlock",
  },
  override: { value: 0.0, reason: "User overrode Guardian intervention" },
  wizard_bookmark: {
    value: 1.0,
    reason: "User engaged deeply with reflection wizard",
  },
};

/** Maps satisfaction feedback to Opik regret-free scores (null = no score) */
export const REGRET_FREE_SCORES: Record<
  string,
  { value: number; reason: string } | null
> = {
  worth_it: { value: 1.0, reason: "User reports purchase was worth it" },
  regret_it: { value: 0.0, reason: "User reports regret about purchase" },
  not_sure: null, // No score — insufficient signal
};

/**
 * Attaches a feedback score to an existing Guardian trace via interactionId lookup.
 * Telemetry failures are caught silently — this must never disrupt user-facing flows.
 */
export async function attachFeedbackScoreToTrace(
  interactionId: string,
  scoreName: string,
  scoreValue: number,
  reason?: string
): Promise<void> {
  try {
    const client = getOpikClient();
    if (!client) {
      return;
    }

    const traces = await client.searchTraces({
      filterString: `metadata.interactionId = "${interactionId}"`,
      maxResults: 1,
    });

    const traceId = traces?.[0]?.id;
    if (!traceId) {
      console.warn(`[Opik] No trace found for interactionId ${interactionId}`);
      return;
    }

    client.logTracesFeedbackScores([
      {
        id: traceId,
        name: scoreName,
        value: scoreValue,
        ...(reason && { reason }),
      },
    ]);

    await client.flush();
  } catch (error) {
    console.warn(
      `[Opik] Failed to attach feedback score for ${interactionId}:`,
      error
    );
  }
}

export function getGuardianTelemetry(
  interactionId: string,
  riskMeta?: { score: number; reasoning: string },
  tier?: string,
  autoApproved?: boolean,
  degraded?: { level: "analyst_only" | "break_glass"; reason: string },
  outcome?: string,
  purchaseContext?: string,
  prediction?: PredictedStrategy
): TelemetrySettings {
  const traceName = resolveTraceName(
    interactionId,
    tier,
    outcome,
    autoApproved,
    degraded
  );

  // For auto-approved, generate reasoning summary immediately (outcome is known)
  const reasoningSummary =
    autoApproved && tier
      ? buildReasoningSummary({
          tier,
          riskScore: riskMeta?.score ?? 0,
          purchaseContext,
          isAutoApproved: true,
        })
      : undefined;

  return {
    ...OpikExporter.getSettings({ name: traceName }),
    metadata: {
      interactionId,
      ...(riskMeta && {
        risk_score: riskMeta.score,
        riskReasoning: riskMeta.reasoning,
      }),
      ...(tier && { tier }),
      ...(purchaseContext && { purchase_context: purchaseContext }),
      ...(autoApproved && { autoApproved: true }),
      ...(reasoningSummary && { reasoning_summary: reasoningSummary }),
      ...(degraded && {
        degraded: true,
        degradationLevel: degraded.level,
        failureReason: degraded.reason,
      }),
      ...(prediction && {
        predicted_next_strategy: JSON.stringify(prediction),
      }),
    },
  };
}
