/**
 * Vercel AI SDK client for unified access to multiple LLM providers.
 * TypeScript equivalent of Python's LiteLLM client.
 */

import { generateText, type LanguageModel } from "ai";
import { LLMClient, type LLMResponse } from "../llm";

/**
 * Configuration for Vercel AI client.
 */
export interface VercelAIConfig {
  /** Model identifier or LanguageModel instance */
  model: string | LanguageModel;

  /** Provider name ('openai', 'anthropic', 'google', etc.) */
  provider?: "openai" | "anthropic" | "google" | "custom";

  /** API key for the provider */
  apiKey?: string;

  /** Base URL for API (for custom endpoints) */
  apiBase?: string;

  /** API version (for providers that require it) */
  apiVersion?: string;

  /** Sampling temperature (0.0 for deterministic) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Nucleus sampling parameter */
  topP?: number;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum number of retries */
  maxRetries?: number;

  /** Fallback models if primary fails */
  fallbacks?: string[];

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Cost tracking enabled */
  trackCost?: boolean;

  /** Maximum budget for requests */
  maxBudget?: number;

  /** Verbose logging */
  verbose?: boolean;

  /** Claude-specific: sampling priority */
  samplingPriority?: "temperature" | "top_p" | "top_k";

  /** Custom HTTP headers */
  extraHeaders?: Record<string, string>;

  /** SSL verification (true/false or path to CA bundle) */
  sslVerify?: boolean | string;
}

/**
 * Production LLM client using Vercel AI SDK.
 *
 * Supports:
 * - OpenAI (GPT-3.5, GPT-4, etc.)
 * - Anthropic (Claude-2, Claude-3, etc.)
 * - Google (Gemini, PaLM)
 * - Custom providers via LanguageModel interface
 *
 * Claude Parameter Handling:
 * Due to Anthropic API limitations, temperature and top_p cannot both be specified
 * for Claude models. This client automatically resolves parameter conflicts using
 * priority-based resolution:
 *
 * - "temperature" (default): Temperature takes precedence
 * - "top_p": Nucleus sampling takes precedence
 * - "top_k": Top-k sampling takes precedence
 *
 * Example:
 * ```typescript
 * import { VercelAIClient } from '@kayba/ace-framework';
 * import { openai } from '@ai-sdk/openai';
 *
 * const client = new VercelAIClient({
 *   model: openai('gpt-4'),
 * });
 *
 * const response = await client.complete('What is the capital of France?');
 * ```
 */
export class VercelAIClient extends LLMClient {
  config: VercelAIConfig;
  private languageModel?: LanguageModel;
  private currentFallbackIndex = 0;

  constructor(config: VercelAIConfig) {
    // Extract model string for parent constructor
    const modelString =
      typeof config.model === "string" ? config.model : undefined;
    super(modelString);

    // Store full config with defaults
    this.config = {
      temperature: 0.0,
      maxTokens: 2048,
      timeout: 60_000,
      maxRetries: 3,
      trackCost: true,
      verbose: false,
      samplingPriority: "temperature",
      ...config,
    };

    // If model is a LanguageModel, store it directly
    if (typeof config.model !== "string") {
      this.languageModel = config.model;
    }

    // Set up API keys from environment if not provided
    this._setupApiKeys();

    // Log verbose mode
    if (this.config.verbose) {
      console.log("[VercelAIClient] Initialized with config:", {
        model: this.model,
        provider: this.config.provider,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
    }
  }

  private _setupApiKeys(): void {
    /**
     * Set up API keys from config or environment variables.
     */
    if (!this.config.apiKey && typeof this.config.model === "string") {
      const modelLower = this.config.model.toLowerCase();

      if (modelLower.includes("gpt") || modelLower.includes("openai")) {
        this.config.apiKey = process.env.OPENAI_API_KEY;
      } else if (
        modelLower.includes("claude") ||
        modelLower.includes("anthropic")
      ) {
        this.config.apiKey = process.env.ANTHROPIC_API_KEY;
      } else if (modelLower.includes("cohere")) {
        this.config.apiKey = process.env.COHERE_API_KEY;
      } else if (modelLower.includes("gemini")) {
        this.config.apiKey = process.env.GOOGLE_API_KEY;
      }
    }
  }

  private async _getLanguageModel(): Promise<LanguageModel> {
    /**
     * Get or create the LanguageModel instance.
     */
    if (this.languageModel) {
      return this.languageModel;
    }

    // Need to create from provider and model string
    if (typeof this.config.model !== "string") {
      throw new Error(
        "Model must be a string if not providing LanguageModel directly"
      );
    }

    if (!this.config.provider) {
      throw new Error("Provider must be specified when using model string");
    }

    const modelString = this.config.model;

    switch (this.config.provider) {
      case "openai": {
        const { createOpenAI } = await import("@ai-sdk/openai");
        const client = createOpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.apiBase,
        });
        this.languageModel = client(modelString) as any;
        break;
      }
      case "anthropic": {
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        const client = createAnthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.apiBase,
        });
        this.languageModel = client(modelString) as any;
        break;
      }
      case "google": {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        const client = createGoogleGenerativeAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.apiBase,
        });
        this.languageModel = client(modelString) as any;
        break;
      }
      case "custom": {
        throw new Error("Custom provider requires LanguageModel instance");
      }
      default: {
        throw new Error(`Unknown provider: ${this.config.provider}`);
      }
    }

    if (!this.languageModel) {
      throw new Error("Failed to create language model");
    }

    return this.languageModel;
  }

  /**
   * Single source of truth for parameter conflict resolution.
   *
   * Anthropic API limitation: temperature and top_p cannot both be specified.
   * This follows industry best practices with clear priority rules.
   *
   * @param params Parameters dictionary to resolve
   * @param modelString Model name to check if Claude
   * @param samplingPriority Priority setting
   * @returns Clean parameters with conflicts resolved
   */
  static resolveSamplingParams(
    params: Record<string, any>,
    modelString: string,
    samplingPriority = "temperature"
  ): Record<string, any> {
    // Only apply to Claude models
    if (!modelString.toLowerCase().includes("claude")) {
      return params;
    }

    if (!["temperature", "top_p", "top_k"].includes(samplingPriority)) {
      throw new Error(
        `Invalid sampling_priority: ${samplingPriority}. Must be one of: temperature, top_p, top_k`
      );
    }

    const resolved = { ...params };

    // Check which sampling params are present and not null/undefined
    const hasTemperature =
      "temperature" in resolved && resolved.temperature != null;
    const hasTopP = "topP" in resolved && resolved.topP != null;
    const hasTopK = "topK" in resolved && resolved.topK != null;

    // Remove null/undefined parameters early
    if ("temperature" in resolved && resolved.temperature == null) {
      resolved.temperature = undefined;
    }
    if ("topP" in resolved && resolved.topP == null) {
      resolved.topP = undefined;
    }
    if ("topK" in resolved && resolved.topK == null) {
      resolved.topK = undefined;
    }

    // Apply priority-based resolution
    if (
      samplingPriority === "temperature" &&
      hasTemperature &&
      resolved.temperature > 0
    ) {
      // Non-zero temperature takes precedence - remove others
      resolved.topP = undefined;
      resolved.topK = undefined;
      if (hasTopP || hasTopK) {
        console.log(
          `[VercelAIClient] Claude model ${modelString}: Using temperature=${resolved.temperature}, ignoring other sampling params`
        );
      }
    } else if (samplingPriority === "top_p" && hasTopP) {
      // top_p takes precedence - remove others
      resolved.temperature = undefined;
      resolved.topK = undefined;
      if (hasTemperature || hasTopK) {
        console.log(
          `[VercelAIClient] Claude model ${modelString}: Using topP=${resolved.topP}, ignoring other sampling params`
        );
      }
    } else if (samplingPriority === "top_k" && hasTopK) {
      // top_k takes precedence - remove others
      resolved.temperature = undefined;
      resolved.topP = undefined;
      if (hasTemperature || hasTopP) {
        console.log(
          `[VercelAIClient] Claude model ${modelString}: Using topK=${resolved.topK}, ignoring other sampling params`
        );
      }
    } else if (hasTemperature && resolved.temperature > 0) {
      // Fallback: use default priority (temperature > top_p > top_k)
      // Non-zero temperature takes precedence over everything
      resolved.topP = undefined;
      resolved.topK = undefined;
    } else if (hasTopP) {
      // top_p takes precedence over temperature=0 and top_k
      resolved.temperature = undefined;
      resolved.topK = undefined;
    } else if (hasTemperature) {
      // Only temperature (including 0), remove others
      resolved.topP = undefined;
      resolved.topK = undefined;
    }
    // If only top_k is set, keep it

    return resolved;
  }

  async complete(prompt: string, options?: any): Promise<LLMResponse> {
    /**
     * Generate completion for the given prompt.
     *
     * @param prompt Input prompt text
     * @param options Additional options (system, temperature, etc.)
     * @returns LLMResponse containing generated text and metadata
     */
    const system = options?.system;
    const kwargs = options || {};

    // Get language model
    const model = await this._getLanguageModel();

    // Prepare messages
    const messages: Array<{ role: string; content: string }> = [];

    if (system) {
      messages.push({ role: "system", content: system });
    }

    messages.push({ role: "user", content: prompt });

    // Merge config with runtime kwargs
    const mergedParams: Record<string, any> = {
      temperature: kwargs.temperature ?? this.config.temperature,
      maxTokens: kwargs.maxTokens ?? kwargs.max_tokens ?? this.config.maxTokens,
    };

    // Add optional sampling parameters if provided
    if (
      kwargs.topP != null ||
      kwargs.top_p != null ||
      this.config.topP != null
    ) {
      mergedParams.topP = kwargs.topP ?? kwargs.top_p ?? this.config.topP;
    }
    if (kwargs.topK != null || kwargs.top_k != null) {
      mergedParams.topK = kwargs.topK ?? kwargs.top_k;
    }

    // Apply single-point parameter resolution for Claude models
    const modelString = this.model || "unknown";
    const callParams = VercelAIClient.resolveSamplingParams(
      mergedParams,
      modelString,
      this.config.samplingPriority
    );

    // Filter out ACE-specific parameters
    const aceSpecificParams = new Set([
      "refinement_round",
      "max_refinement_rounds",
      "stream_thinking",
      "system", // Already handled
    ]);

    // Add remaining kwargs (excluding ACE-specific and already-handled parameters)
    const handledParams = new Set([
      "temperature",
      "topP",
      "top_p",
      "topK",
      "top_k",
      "maxTokens",
      "max_tokens",
      "timeout",
      "num_retries",
    ]);

    for (const [key, value] of Object.entries(kwargs)) {
      if (
        !(
          callParams[key] ||
          aceSpecificParams.has(key) ||
          handledParams.has(key)
        )
      ) {
        callParams[key] = value;
      }
    }

    try {
      // Call Vercel AI SDK
      const result = await generateText({
        model,
        prompt,
        system,
        ...callParams,
      });

      // Build metadata
      const metadata: Record<string, any> = {
        model: modelString,
        usage: result.usage,
        finishReason: result.finishReason,
        provider: this._getProviderFromModel(modelString),
      };

      if (this.config.verbose) {
        console.log("[VercelAIClient] Completion result:", {
          textLength: result.text.length,
          usage: result.usage,
          finishReason: result.finishReason,
        });
      }

      return {
        text: result.text,
        raw: metadata,
      };
    } catch (error: any) {
      // Try fallbacks if available
      if (
        this.config.fallbacks &&
        this.currentFallbackIndex < this.config.fallbacks.length
      ) {
        const fallbackModel = this.config.fallbacks[this.currentFallbackIndex];
        this.currentFallbackIndex++;

        console.warn(
          `[VercelAIClient] Primary model failed, trying fallback: ${fallbackModel}`
        );

        // Create new client with fallback model
        const fallbackClient = new VercelAIClient({
          ...this.config,
          model: fallbackModel,
        });

        return fallbackClient.complete(prompt, options);
      }

      console.error("[VercelAIClient] Error in completion:", error);
      throw error;
    }
  }

  async completeWithStream(
    prompt: string,
    options?: any
  ): Promise<AsyncIterable<string>> {
    /**
     * Generate completion with streaming support.
     *
     * @param prompt Input prompt text
     * @param options Additional options
     * @returns AsyncIterable of text chunks
     */
    const model = await this._getLanguageModel();
    const system = options?.system;

    // Dynamic import for streaming
    const { streamText } = await import("ai");

    const mergedParams: Record<string, any> = {
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens:
        options?.maxTokens ?? options?.max_tokens ?? this.config.maxTokens,
    };

    try {
      const result = streamText({
        model,
        prompt,
        system,
        ...mergedParams,
      });

      // Return async generator that yields text deltas
      return (async function* () {
        for await (const chunk of result.textStream) {
          yield chunk;
        }
      })();
    } catch (error: any) {
      console.error("[VercelAIClient] Error in streaming:", error);
      throw error;
    }
  }

  private _getProviderFromModel(modelString: string): string {
    /**
     * Infer provider from model name.
     */
    const modelLower = modelString.toLowerCase();

    if (modelLower.includes("gpt") || modelLower.includes("openai")) {
      return "openai";
    }
    if (modelLower.includes("claude") || modelLower.includes("anthropic")) {
      return "anthropic";
    }
    if (modelLower.includes("gemini") || modelLower.includes("palm")) {
      return "google";
    }
    if (modelLower.includes("command") || modelLower.includes("cohere")) {
      return "cohere";
    }
    if (modelLower.includes("llama") || modelLower.includes("mistral")) {
      return "meta";
    }
    return "unknown";
  }

  /**
   * List common supported models.
   * Note: Vercel AI SDK supports many more models through different providers.
   */
  static listModels(): string[] {
    return [
      // OpenAI
      "gpt-4",
      "gpt-4-turbo",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k",
      // Anthropic
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-20241022",
      "claude-2.1",
      "claude-2",
      // Google
      "gemini-pro",
      "gemini-pro-vision",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      // Note: Many more models are supported
      // See: https://sdk.vercel.ai/providers
    ];
  }
}

/**
 * Helper function to create VercelAIClient from simple parameters.
 *
 * @param params Configuration parameters
 * @returns Configured VercelAIClient instance
 */
export function createVercelAIClient(params: {
  provider: "openai" | "anthropic" | "google";
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  options?: Partial<VercelAIConfig>;
}): VercelAIClient {
  return new VercelAIClient({
    model: params.model,
    provider: params.provider,
    apiKey: params.apiKey,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    ...params.options,
  });
}
