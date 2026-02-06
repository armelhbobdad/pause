import "server-only";

export type InteractionTier = "analyst" | "negotiator" | "therapist";

// TODO(demo): Make tier thresholds configurable via env vars if demo tuning needed
export function determineTier(score: number): InteractionTier {
  if (score >= 70) {
    return "therapist";
  }
  if (score >= 30) {
    return "negotiator";
  }
  return "analyst";
}
