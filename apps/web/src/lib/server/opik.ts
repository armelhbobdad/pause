import "server-only";
import type { TelemetrySettings } from "ai";
import { OpikExporter } from "opik-vercel";

export function getGuardianTelemetry(interactionId: string): TelemetrySettings {
  return {
    ...OpikExporter.getSettings({ name: `guardian-${interactionId}` }),
    metadata: { interactionId },
  };
}
