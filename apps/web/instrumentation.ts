import { registerOTel } from "@vercel/otel";

const SERVICE_NAME = "pause-guardian";

export async function register() {
  // Only initialize OpikExporter if OPIK_API_KEY is set
  // This prevents crashes in development without an Opik account
  if (process.env.OPIK_API_KEY) {
    try {
      const { OpikExporter } = await import("opik-vercel");
      registerOTel({
        serviceName: SERVICE_NAME,
        traceExporter: new OpikExporter({
          tags: ["hackathon", "pause"],
        }),
      });
    } catch (error) {
      // Log error and fall back to basic OTel instrumentation
      console.error(
        "[Opik] Failed to load opik-vercel:",
        error instanceof Error ? error.message : error
      );
      registerOTel({
        serviceName: SERVICE_NAME,
      });
    }
  } else {
    console.warn(
      "[Opik] OPIK_API_KEY not set - traces will not be sent to Opik. Set this environment variable for observability."
    );
    // Register OTel without Opik exporter for basic instrumentation
    registerOTel({
      serviceName: SERVICE_NAME,
    });
  }
}
