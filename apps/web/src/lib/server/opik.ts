import "server-only";
import type { TelemetrySettings } from "ai";
import { Opik } from "opik";
import { OpikExporter } from "opik-vercel";

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

export function getGuardianTelemetry(
  interactionId: string,
  riskMeta?: { score: number; reasoning: string }
): TelemetrySettings {
  return {
    ...OpikExporter.getSettings({ name: `guardian-${interactionId}` }),
    metadata: {
      interactionId,
      ...(riskMeta && {
        riskScore: riskMeta.score,
        riskReasoning: riskMeta.reasoning,
      }),
    },
  };
}
