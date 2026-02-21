import "server-only";

import { google } from "@ai-sdk/google";
import { env } from "@pause/env/server";
import type { LanguageModel } from "ai";
import { createZhipu } from "zhipu-ai-provider";

let zhipuInstance: ReturnType<typeof createZhipu> | undefined;

function getZhipu() {
  if (!env.ZHIPU_API_KEY) {
    throw new Error(
      'ZHIPU_API_KEY is required when AI_MODEL uses the "zhipu" provider.'
    );
  }
  if (!zhipuInstance) {
    zhipuInstance = createZhipu({
      apiKey: env.ZHIPU_API_KEY,
      baseURL: "https://api.z.ai/api/paas/v4",
    });
  }
  return zhipuInstance;
}

/**
 * Returns the configured AI language model based on the AI_MODEL env var.
 *
 * Format: "provider:model" (e.g., "google:gemini-3-flash-preview", "zhipu:glm-4.7")
 * Default: "google:gemini-3-flash-preview"
 *
 * Rate limits (Gemini 3 Flash Preview): 10 RPM, 250 RPD.
 *
 * Provider-specific configuration is handled internally:
 * - Zhipu: Deep thinking mode is disabled to reduce latency.
 */
export function getModel(): LanguageModel {
  const modelId = env.AI_MODEL;
  const colonIndex = modelId.indexOf(":");
  const provider = modelId.slice(0, colonIndex);
  const modelName = modelId.slice(colonIndex + 1);

  switch (provider) {
    case "zhipu":
      return getZhipu()(modelName, { thinking: { type: "disabled" } });
    case "google":
      return google(modelName);
    default:
      throw new Error(
        `Unknown AI provider "${provider}". Supported: google, zhipu.`
      );
  }
}
