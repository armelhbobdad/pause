/**
 * Agent, Reflector, and SkillManager components.
 */

import { z } from "zod";
import type { LLMClient } from "./llm";
import {
  createAgentPrompt,
  createReflectorPrompt,
  createSkillManagerPrompt,
} from "./prompts";
import type { Skillbook } from "./skillbook";
import { type UpdateBatch, updateBatchFromJSON } from "./updates";

// ================================
// UTILITY FUNCTIONS
// ================================

function safeJsonLoads(text: string): Record<string, any> {
  /**
   * Parse JSON from LLM response, handling markdown code blocks.
   */
  let cleanText = text.trim();

  // Handle opening fence (with or without language identifier)
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.slice(7).trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.slice(3).trim();
  }

  // Handle closing fence (if present)
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.slice(0, -3).trim();
  }

  try {
    const data = JSON.parse(cleanText);
    if (typeof data !== "object" || data === null) {
      throw new Error("Expected a JSON object from LLM.");
    }
    return data;
  } catch (exc) {
    throw new Error(`LLM response is not valid JSON: ${exc}\n${cleanText}`);
  }
}

export function extractCitedSkillIds(text: string): string[] {
  /**
   * Extract skill IDs cited in text using [id-format] notation.
   *
   * Parses text to find all skill ID citations in format [section-00001].
   * Used to track which strategies were applied by analyzing reasoning traces.
   *
   * @param text - Text containing skill citations (reasoning, thoughts, etc.)
   * @returns List of unique skill IDs in order of first appearance. Empty list if no citations found.
   *
   * @example
   * ```typescript
   * const reasoning = "Following [general-00042], I verified the data. Using [geo-00003] for lookup.";
   * extractCitedSkillIds(reasoning); // ['general-00042', 'geo-00003']
   * ```
   */
  // Match [section-digits] pattern
  const matches = text.matchAll(/\[([a-zA-Z_]+-\d+)\]/g);
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const id = match[1];
    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }

  return ids;
}

// ================================
// AGENT ROLE
// ================================

export interface AgentOutput {
  /** Output from the Agent role containing reasoning and answer */
  reasoning: string;
  final_answer: string;
  skill_ids: string[];
  raw?: Record<string, any>;
}

const AgentOutputSchema = z.object({
  reasoning: z.string().describe("Step-by-step reasoning process"),
  final_answer: z.string().describe("The final answer to the question"),
  skill_ids: z
    .array(z.string())
    .optional()
    .default([])
    .describe("IDs of strategies cited in reasoning"),
  raw: z
    .record(z.string(), z.any())
    .optional()
    .default({})
    .describe("Raw LLM response data"),
});

export class Agent {
  /**
   * Produces answers using the current skillbook of strategies.
   *
   * The Agent is one of three core ACE roles. It takes a question and
   * uses the accumulated strategies in the skillbook to produce reasoned answers.
   *
   * @param llm - The LLM client to use for generation
   * @param promptTemplate - Custom prompt template function (optional)
   *
   * @example
   * ```typescript
   * import { Agent, VercelAIClient, Skillbook } from './index.js';
   * import { openai } from '@ai-sdk/openai';
   *
   * const client = new VercelAIClient({ model: openai('gpt-3.5-turbo') });
   * const agent = new Agent(client);
   * const skillbook = new Skillbook();
   *
   * const output = await agent.generate({
   *   question: "What is the capital of France?",
   *   context: "Answer concisely",
   *   skillbook
   * });
   * console.log(output.final_answer); // "Paris"
   * ```
   */
  constructor(
    private readonly llm: LLMClient,
    private readonly promptTemplate?: (params: {
      skillbook: Skillbook;
      question: string;
      context?: string;
      reflection?: string;
    }) => string
  ) {
    this.promptTemplate = promptTemplate ?? createAgentPrompt;
  }

  async generate(params: {
    question: string;
    context?: string;
    skillbook: Skillbook;
    reflection?: string;
  }): Promise<AgentOutput> {
    /**
     * Generate an answer using the skillbook strategies.
     *
     * @param params.question - The question to answer
     * @param params.context - Additional context or requirements
     * @param params.skillbook - The current skillbook of strategies
     * @param params.reflection - Optional reflection from previous attempts
     * @returns AgentOutput with reasoning, final_answer, and skill_ids used
     */
    const prompt = this.promptTemplate?.(params) ?? "";

    // Try structured output first if available
    if (
      "completeStructured" in this.llm &&
      typeof (this.llm as any).completeStructured === "function"
    ) {
      const output = await (this.llm as any).completeStructured(
        prompt,
        AgentOutputSchema
      );
      output.skill_ids = extractCitedSkillIds(output.reasoning);
      return output;
    }

    // Fallback to text completion and manual JSON parsing
    const response = await this.llm.complete(prompt);
    const data = safeJsonLoads(response.text);
    const output: AgentOutput = {
      reasoning: data.reasoning ?? "",
      final_answer: data.final_answer ?? "",
      skill_ids: data.skill_ids ?? [],
      raw: data,
    };
    output.skill_ids = extractCitedSkillIds(output.reasoning);
    return output;
  }
}

// ================================
// REPLAY AGENT (for offline training)
// ================================

export class ReplayAgent {
  /**
   * Replays pre-recorded responses instead of calling an LLM.
   *
   * Useful for offline training from historical data (logs, traces, etc.)
   * where you want ACE to learn from actual past interactions without
   * generating new responses.
   *
   * @param responses - Dict mapping questions to their pre-recorded answers (optional)
   * @param defaultResponse - Response to return if question not found (default: "")
   *
   * @example
   * ```typescript
   * const responses = {
   *   "What is 2+2?": "4",
   *   "What is the capital of France?": "Paris"
   * };
   * const agent = new ReplayAgent(responses);
   * const output = await agent.generate({
   *   question: "What is 2+2?",
   *   skillbook: new Skillbook()
   * });
   * console.log(output.final_answer); // "4"
   * ```
   */
  constructor(
    private readonly responses: Record<string, string> = {},
    private readonly defaultResponse = ""
  ) {}

  async generate(params: {
    question: string;
    context?: string;
    skillbook: Skillbook;
    reflection?: string;
    sample?: any;
  }): Promise<AgentOutput> {
    // Try to extract response from sample first (for list-based datasets)
    if (params.sample) {
      const fromSample = this.extractResponseFromSample(params.sample);
      if (fromSample) {
        return {
          reasoning: "Replay from sample",
          final_answer: fromSample,
          skill_ids: [],
        };
      }
    }

    // Fallback to dict-based lookup
    const answer = this.responses[params.question] ?? this.defaultResponse;
    return {
      reasoning: "Replay from dict",
      final_answer: answer,
      skill_ids: [],
    };
  }

  private extractResponseFromSample(sample: any): string | null {
    // Try sample.metadata['response'] (dataclass-style)
    if (sample.metadata && typeof sample.metadata === "object") {
      const response = sample.metadata.response;
      if (response) {
        return String(response);
      }
    }

    // Try sample['metadata']['response'] (nested dict)
    if (
      typeof sample === "object" &&
      sample.metadata &&
      typeof sample.metadata === "object"
    ) {
      const response = sample.metadata.response;
      if (response) {
        return String(response);
      }
    }

    // Try sample['response'] (direct dict)
    if (typeof sample === "object" && sample.response) {
      return String(sample.response);
    }

    return null;
  }
}

// ================================
// REFLECTOR ROLE
// ================================

export interface ReflectorOutput {
  /** Output from the Reflector role analyzing generator performance */
  analysis: string;
  helpful_skill_ids: string[];
  harmful_skill_ids: string[];
  new_learnings: Array<{
    section: string;
    content: string;
    atomicity_score: number;
  }>;
  reflection_quality?: {
    root_cause_identified: boolean;
    learnings_actionable: boolean;
    evidence_based: boolean;
  };
}

const ReflectorOutputSchema = z.object({
  analysis: z.string().describe("Detailed diagnostic analysis"),
  helpful_skill_ids: z.array(z.string()).default([]),
  harmful_skill_ids: z.array(z.string()).default([]),
  new_learnings: z
    .array(
      z.object({
        section: z.string(),
        content: z.string(),
        atomicity_score: z.number(),
      })
    )
    .default([]),
  reflection_quality: z
    .object({
      root_cause_identified: z.boolean(),
      learnings_actionable: z.boolean(),
      evidence_based: z.boolean(),
    })
    .optional(),
});

export class Reflector {
  /**
   * Analyzes generator performance and extracts learnings.
   *
   * The Reflector is the second core ACE role. It examines the agent's
   * output and execution feedback to identify what worked, what failed,
   * and what can be learned.
   *
   * @param llm - The LLM client to use for reflection
   * @param promptTemplate - Custom prompt template function (optional)
   */
  constructor(
    private readonly llm: LLMClient,
    private readonly promptTemplate?: (params: {
      question: string;
      generatorAnswer: string;
      feedback: string;
      groundTruth?: string;
      skillbook: Skillbook;
    }) => string
  ) {
    this.promptTemplate = promptTemplate ?? createReflectorPrompt;
  }

  async reflect(params: {
    question: string;
    generatorAnswer: string;
    feedback: string;
    groundTruth?: string;
    skillbook: Skillbook;
  }): Promise<ReflectorOutput> {
    const prompt = this.promptTemplate?.(params) ?? "";

    // Try structured output first if available
    if (
      "completeStructured" in this.llm &&
      typeof (this.llm as any).completeStructured === "function"
    ) {
      return await (this.llm as any).completeStructured(
        prompt,
        ReflectorOutputSchema
      );
    }

    // Fallback to text completion and manual JSON parsing
    const response = await this.llm.complete(prompt);
    const data = safeJsonLoads(response.text);
    return {
      analysis: data.analysis ?? "",
      helpful_skill_ids: data.helpful_skill_ids ?? [],
      harmful_skill_ids: data.harmful_skill_ids ?? [],
      new_learnings: data.new_learnings ?? [],
      reflection_quality: data.reflection_quality,
    };
  }
}

// ================================
// SKILL MANAGER ROLE
// ================================

export class SkillManager {
  /**
   * Converts reflection analysis into skillbook update operations.
   *
   * The SkillManager is the third core ACE role. It takes the Reflector's
   * analysis and produces atomic update operations (ADD, UPDATE, TAG, REMOVE)
   * to evolve the skillbook.
   *
   * @param llm - The LLM client to use for curation
   * @param promptTemplate - Custom prompt template function (optional)
   */
  constructor(
    private readonly llm: LLMClient,
    private readonly promptTemplate?: (params: {
      reflectionAnalysis: string;
      skillbook: Skillbook;
    }) => string
  ) {
    this.promptTemplate = promptTemplate ?? createSkillManagerPrompt;
  }

  async curate(params: {
    reflectionAnalysis: string;
    skillbook: Skillbook;
  }): Promise<UpdateBatch> {
    const prompt = this.promptTemplate?.(params) ?? "";

    // Get response from LLM
    const response = await this.llm.complete(prompt);
    const data = safeJsonLoads(response.text);

    // Convert to UpdateBatch
    return updateBatchFromJSON(data);
  }
}
