/**
 * Simple ACE integration - equivalent to ACELiteLLM in Python
 */

import type { LanguageModel } from "ai";
import { VercelAIClient } from "../llm.js";
import { Agent, Reflector, SkillManager } from "../roles.js";
import { Skillbook } from "../skillbook.js";

export interface ACEAgentConfig {
  /** The language model to use (from Vercel AI SDK) */
  model: LanguageModel;
  /** Path to load/save skillbook */
  skillbookPath?: string;
  /** Pre-loaded skillbook instance */
  skillbook?: Skillbook;
  /** Model options */
  modelOptions?: any;
}

export class ACEAgent {
  /**
   * Create Your Self-Improving Agent (Simplest Start)
   *
   * Perfect for Q&A, classification, reasoning tasks.
   * Automatically learns from each interaction and improves over time.
   *
   * @example
   * ```typescript
   * import { ACEAgent } from '@kayba/ace-framework';
   * import { openai } from '@ai-sdk/openai';
   *
   * // Create self-improving agent
   * const agent = new ACEAgent({
   *   model: openai('gpt-4o-mini')
   * });
   *
   * // Ask related questions - agent learns patterns
   * const answer1 = await agent.ask("If all cats are animals, is Felix (a cat) an animal?");
   * const answer2 = await agent.ask("If all birds fly, can penguins (birds) fly?");
   * const answer3 = await agent.ask("If all metals conduct electricity, does copper conduct electricity?");
   *
   * // View learned strategies
   * console.log(`✅ Learned ${agent.skillbook.skills().length} reasoning skills`);
   *
   * // Save for reuse
   * agent.saveSkillbook("my_agent.json");
   *
   * // Load and continue
   * const agent2 = ACEAgent.fromSkillbook("my_agent.json", openai('gpt-4o-mini'));
   * ```
   */
  skillbook: Skillbook;
  private readonly llmClient: VercelAIClient;
  private readonly agent: Agent;
  private readonly reflector: Reflector;
  private readonly skillManager: SkillManager;
  private skillbookPath?: string;

  constructor(config: ACEAgentConfig) {
    this.skillbook = config.skillbook ?? new Skillbook();
    this.skillbookPath = config.skillbookPath;

    // Load skillbook from file if path provided
    if (this.skillbookPath) {
      try {
        this.skillbook = Skillbook.loadFromFile(this.skillbookPath);
      } catch (_err) {
        // File doesn't exist yet, will create on first save
      }
    }

    // Create LLM client
    this.llmClient = new VercelAIClient({
      model: config.model,
      defaultOptions: config.modelOptions,
    });

    // Create ACE roles
    this.agent = new Agent(this.llmClient);
    this.reflector = new Reflector(this.llmClient);
    this.skillManager = new SkillManager(this.llmClient);
  }

  async ask(question: string, context?: string): Promise<string> {
    /**
     * Ask a question and get an answer.
     * The agent learns automatically from the interaction.
     *
     * @param question - The question to answer
     * @param context - Optional additional context
     * @returns The answer to the question
     */
    // Generate answer using current skillbook
    const output = await this.agent.generate({
      question,
      context,
      skillbook: this.skillbook,
    });

    // Automatically learn from this interaction
    // In a full implementation, you'd also get feedback/ground truth
    // For now, we'll do a simple reflection assuming success
    const reflection = await this.reflector.reflect({
      question,
      generatorAnswer: output.final_answer,
      feedback: "Answer generated successfully",
      skillbook: this.skillbook,
    });

    // Update skillbook based on reflection
    const updates = await this.skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook: this.skillbook,
    });

    this.skillbook.applyUpdate(updates);

    // Auto-save if path provided
    if (this.skillbookPath) {
      this.saveSkillbook(this.skillbookPath);
    }

    return output.final_answer;
  }

  saveSkillbook(path: string): void {
    /**
     * Save the learned skillbook to a file.
     *
     * @param path - File path where to save
     */
    this.skillbook.saveToFile(path);
    this.skillbookPath = path;
  }

  static fromSkillbook(
    skillbookPath: string,
    model: LanguageModel,
    modelOptions?: any
  ): ACEAgent {
    /**
     * Load an ACEAgent with a pre-trained skillbook.
     *
     * @param skillbookPath - Path to the skillbook file
     * @param model - Language model to use
     * @param modelOptions - Optional model configuration
     * @returns ACEAgent instance with loaded skillbook
     */
    return new ACEAgent({
      model,
      skillbookPath,
      modelOptions,
    });
  }

  getStats(): Record<string, any> {
    /**
     * Get statistics about the learned skillbook.
     *
     * @returns Object with sections, skills, and tag counts
     */
    return this.skillbook.stats();
  }
}
