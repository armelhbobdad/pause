/**
 * Adaptation loops for offline and online ACE training.
 *
 * Provides orchestration for two learning modes:
 * - OfflineACE: Multi-epoch training over fixed dataset
 * - OnlineACE: Sequential learning from streaming samples
 */

import type {
  Agent,
  AgentOutput,
  Reflector,
  ReflectorOutput,
  SkillManager,
} from "./roles";
import { Skillbook } from "./skillbook";
import type { UpdateBatch } from "./updates";

/**
 * Single task instance presented to ACE.
 */
export interface Sample {
  question: string;
  context?: string;
  groundTruth?: string;
  metadata?: Record<string, any>;
}

/**
 * Feedback returned by the task environment after evaluating agent output.
 */
export interface EnvironmentResult {
  feedback: string;
  groundTruth?: string;
  metrics?: Record<string, number>;
}

/**
 * Abstract interface for evaluating agent outputs.
 *
 * Implement this class to define how your specific task evaluates
 * the Agent's answers. The environment provides feedback that
 * helps ACE learn what works and what doesn't.
 *
 * @example
 * ```typescript
 * class MathEnvironment implements TaskEnvironment {
 *   evaluate(sample: Sample, agentOutput: AgentOutput): EnvironmentResult {
 *     // Parse the answer
 *     const predicted = extractNumber(agentOutput.finalAnswer);
 *     const correct = predicted.toString() === sample.groundTruth;
 *
 *     // Provide feedback
 *     const feedback = correct
 *       ? "Correct!"
 *       : `Incorrect. Expected ${sample.groundTruth}`;
 *
 *     return {
 *       feedback,
 *       groundTruth: sample.groundTruth,
 *       metrics: { accuracy: correct ? 1.0 : 0.0 }
 *     };
 *   }
 * }
 * ```
 */
export interface TaskEnvironment {
  /**
   * Evaluate the agent's output for a given sample.
   *
   * @param sample The input sample with question and context
   * @param agentOutput The Agent's produced answer
   * @returns EnvironmentResult with feedback and optional ground truth
   *
   * The feedback should be informative enough for the Reflector
   * to understand what went right or wrong.
   */
  evaluate(sample: Sample, agentOutput: AgentOutput): EnvironmentResult;
}

/**
 * Simple built-in environment for quick testing and demos.
 *
 * Checks if the ground truth appears in the answer (case-insensitive).
 * Perfect for getting started without creating a custom environment.
 *
 * @example
 * ```typescript
 * import { SimpleEnvironment, Sample } from './adaptation';
 *
 * const env = new SimpleEnvironment();
 * const sample: Sample = { question: "What is 2+2?", groundTruth: "4" };
 * const result = env.evaluate(sample, agentOutput);
 * ```
 */
export class SimpleEnvironment implements TaskEnvironment {
  evaluate(sample: Sample, agentOutput: AgentOutput): EnvironmentResult {
    if (!sample.groundTruth) {
      return {
        feedback: "No ground truth provided",
        groundTruth: undefined,
        metrics: { correct: 0.0 },
      };
    }

    const answer = agentOutput.final_answer.toLowerCase();
    const truth = sample.groundTruth.toLowerCase();
    const isCorrect = answer.includes(truth);

    return {
      feedback: isCorrect
        ? "Correct!"
        : `Incorrect. Expected: ${sample.groundTruth}`,
      groundTruth: sample.groundTruth,
      metrics: { correct: isCorrect ? 1.0 : 0.0 },
    };
  }
}

/**
 * Result from processing a single sample through the ACE pipeline.
 */
export interface ACEStepResult {
  sample: Sample;
  agentOutput: AgentOutput;
  environmentResult: EnvironmentResult;
  reflection: ReflectorOutput;
  updateBatch: UpdateBatch;
  skillbookSnapshot: string;
  epoch: number;
  step: number;
  performanceScore?: number;
}

/**
 * Configuration options for ACE adaptation.
 */
export interface ACEConfig {
  /** Initial skillbook (creates empty one if not provided) */
  skillbook?: Skillbook;
  /** Agent instance for producing answers */
  agent: Agent;
  /** Reflector instance for analyzing outcomes */
  reflector: Reflector;
  /** SkillManager instance for updating skillbook */
  skillManager: SkillManager;
  /** Max reflection refinement attempts (default: 1) */
  maxRefinementRounds?: number;
  /** Number of recent reflections to maintain (default: 3) */
  reflectionWindow?: number;
}

/**
 * Shared orchestration logic for offline and online ACE adaptation.
 */
abstract class ACEBase {
  protected skillbook: Skillbook;
  protected agent: Agent;
  protected reflector: Reflector;
  protected skillManager: SkillManager;
  protected maxRefinementRounds: number;
  protected reflectionWindow: number;
  protected recentReflections: string[];

  constructor(config: ACEConfig) {
    this.skillbook = config.skillbook || new Skillbook();
    this.agent = config.agent;
    this.reflector = config.reflector;
    this.skillManager = config.skillManager;
    this.maxRefinementRounds = config.maxRefinementRounds || 1;
    this.reflectionWindow = config.reflectionWindow || 3;
    this.recentReflections = [];
  }

  /**
   * Get reflection context from recent reflections.
   */
  protected reflectionContext(): string {
    return this.recentReflections.join("\n---\n");
  }

  /**
   * Update recent reflections buffer.
   */
  protected updateRecentReflections(reflection: ReflectorOutput): void {
    const serialized = JSON.stringify(reflection, null, 0);
    this.recentReflections.push(serialized);
    if (this.recentReflections.length > this.reflectionWindow) {
      this.recentReflections = this.recentReflections.slice(
        -this.reflectionWindow
      );
    }
  }

  /**
   * Apply skill tags from reflection.
   */
  protected applySkillTags(reflection: ReflectorOutput): void {
    // Tag helpful skills
    for (const skillId of reflection.helpful_skill_ids) {
      try {
        this.skillbook.tagSkill(skillId, "helpful");
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional — skip unknown skill IDs silently
      } catch (_error) {}
    }

    // Tag harmful skills
    for (const skillId of reflection.harmful_skill_ids) {
      try {
        this.skillbook.tagSkill(skillId, "harmful");
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional — skip unknown skill IDs silently
      } catch (_error) {}
    }
  }

  /**
   * Format question context for skill manager.
   */
  protected questionContext(
    sample: Sample,
    environmentResult: EnvironmentResult
  ): string {
    const parts = [
      `question: ${sample.question}`,
      `context: ${sample.context || ""}`,
      `metadata: ${JSON.stringify(sample.metadata || {})}`,
      `feedback: ${environmentResult.feedback}`,
      `ground_truth: ${environmentResult.groundTruth || ""}`,
    ];
    return parts.join("\n");
  }

  /**
   * Format progress string.
   */
  protected progressString(
    epoch: number,
    totalEpochs: number,
    step: number,
    totalSteps: number
  ): string {
    return `epoch ${epoch}/${totalEpochs} · sample ${step}/${totalSteps}`;
  }

  /**
   * Calculate performance score from metrics.
   */
  protected calculatePerformanceScore(
    metrics: Record<string, number> | undefined
  ): number {
    if (!metrics) {
      return 0.0;
    }

    // Only use boolean/probability metrics that represent success/quality (0-1 range)
    const scoreKeys = [
      "correct",
      "efficient",
      "success",
      "accuracy",
      "score",
      "syntax_valid",
      "contains_required",
    ];

    const scoreMetrics: number[] = [];
    for (const [key, value] of Object.entries(metrics)) {
      if (scoreKeys.includes(key) && typeof value === "number") {
        scoreMetrics.push(value);
      }
    }

    if (scoreMetrics.length === 0) {
      return 0.0;
    }
    return scoreMetrics.reduce((a, b) => a + b, 0) / scoreMetrics.length;
  }

  /**
   * Process a single sample through the ACE pipeline.
   */
  protected async processSample(
    sample: Sample,
    environment: TaskEnvironment,
    epoch: number,
    _totalEpochs: number,
    stepIndex: number,
    _totalSteps: number
  ): Promise<ACEStepResult> {
    // Step 1: Agent generates answer
    const agentOutput = await this.agent.generate({
      question: sample.question,
      context: sample.context,
      skillbook: this.skillbook,
      reflection: this.reflectionContext(),
    });

    // Step 2: Environment evaluates
    const envResult = environment.evaluate(sample, agentOutput);

    // Step 3: Reflector analyzes
    const reflection = await this.reflector.reflect({
      question: sample.question,
      generatorAnswer: agentOutput.final_answer,
      feedback: envResult.feedback,
      groundTruth: envResult.groundTruth,
      skillbook: this.skillbook,
    });

    // Step 4: Apply tags and update reflection context
    this.applySkillTags(reflection);
    this.updateRecentReflections(reflection);

    // Step 5: SkillManager updates skillbook
    const updateBatch = await this.skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook: this.skillbook,
    });

    // Step 6: Apply update to skillbook
    this.skillbook.applyUpdate(updateBatch);

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(envResult.metrics);

    return {
      sample,
      agentOutput,
      environmentResult: envResult,
      reflection,
      updateBatch,
      skillbookSnapshot: this.skillbook.asPrompt(),
      epoch,
      step: stepIndex,
      performanceScore,
    };
  }

  /**
   * Get the current skillbook.
   */
  getSkillbook(): Skillbook {
    return this.skillbook;
  }
}

/**
 * Options for offline ACE training.
 */
export interface OfflineACERunOptions {
  /** Number of times to iterate over samples (default: 1) */
  epochs?: number;
  /** Save skillbook every N successful samples (optional) */
  checkpointInterval?: number;
  /** Directory to save checkpoints (required if checkpointInterval set) */
  checkpointDir?: string;
}

/**
 * Orchestrates offline ACE adaptation over multiple training epochs.
 *
 * The OfflineACE processes a fixed training set multiple times,
 * allowing the skillbook to evolve and improve through repeated exposure
 * to the same examples. This is useful for building a robust initial
 * skillbook before deployment.
 *
 * @example
 * ```typescript
 * import { OfflineACE, Agent, Reflector, SkillManager, Sample } from 'ace-ts';
 * import { VercelAIClient } from 'ace-ts';
 *
 * // Initialize components with same LLM
 * const client = new VercelAIClient({ model: 'gpt-4' });
 * const agent = new Agent(client);
 * const reflector = new Reflector(client);
 * const skillManager = new SkillManager(client);
 *
 * // Create ACE
 * const ace = new OfflineACE({
 *   agent,
 *   reflector,
 *   skillManager
 * });
 *
 * // Prepare training samples
 * const samples: Sample[] = [
 *   { question: "What is 2+2?", groundTruth: "4" },
 *   { question: "What is 5*3?", groundTruth: "15" }
 * ];
 *
 * // Run adaptation for 3 epochs
 * const results = await ace.run(samples, environment, { epochs: 3 });
 *
 * // Access evolved skillbook
 * console.log(ace.getSkillbook().asPrompt());
 * ```
 *
 * The ACE will:
 * 1. Process each sample through Agent → Environment → Reflector → SkillManager
 * 2. Update the skillbook after each sample
 * 3. Repeat for the specified number of epochs
 * 4. Return detailed results for analysis
 */
export class OfflineACE extends ACEBase {
  /**
   * Run offline adaptation over training samples.
   *
   * @param samples Training samples to process
   * @param environment Environment for evaluating agent outputs
   * @param options Run options (epochs, checkpointing)
   * @returns List of ACEStepResult for each processed sample
   *
   * Note:
   * - The skillbook is updated in-place during adaptation
   * - Access the evolved skillbook via ace.getSkillbook() after running
   * - Failed samples are skipped and logged, training continues
   */
  async run(
    samples: Sample[],
    environment: TaskEnvironment,
    options: OfflineACERunOptions = {}
  ): Promise<ACEStepResult[]> {
    const epochs = options.epochs || 1;
    const checkpointInterval = options.checkpointInterval;
    const checkpointDir = options.checkpointDir;

    // Validate checkpoint parameters
    if (checkpointInterval !== undefined && !checkpointDir) {
      throw new Error(
        "checkpointDir must be provided when checkpointInterval is set"
      );
    }

    const results: ACEStepResult[] = [];
    const failedSamples: Array<{ epoch: number; step: number; error: string }> =
      [];
    const totalSteps = samples.length;

    for (let epoch = 1; epoch <= epochs; epoch++) {
      for (let stepIdx = 1; stepIdx <= samples.length; stepIdx++) {
        const sample = samples[stepIdx - 1];

        try {
          const result = await this.processSample(
            sample,
            environment,
            epoch,
            epochs,
            stepIdx,
            totalSteps
          );
          results.push(result);

          // Save checkpoint if interval reached
          if (
            checkpointInterval &&
            checkpointDir &&
            results.length % checkpointInterval === 0
          ) {
            const numberedCheckpoint = `${checkpointDir}/ace_checkpoint_${results.length}.json`;
            const latestCheckpoint = `${checkpointDir}/ace_latest.json`;

            await this.skillbook.saveToFile(numberedCheckpoint);
            await this.skillbook.saveToFile(latestCheckpoint);
            console.log(
              `Checkpoint saved: ${results.length} samples → ${numberedCheckpoint}`
            );
          }
        } catch (error) {
          // Log error and continue to next sample
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.warn(
            `Failed to process sample ${stepIdx}/${totalSteps} in epoch ${epoch}/${epochs}: ${errorMsg.slice(0, 200)}`
          );
          failedSamples.push({
            epoch,
            step: stepIdx,
            error: errorMsg.slice(0, 100),
          });
        }
      }
    }

    // Report failure summary if any samples failed
    if (failedSamples.length > 0) {
      console.log(
        `Training completed with ${failedSamples.length} failed samples out of ${samples.length * epochs} total attempts`
      );
    }

    return results;
  }
}

/**
 * Orchestrates online ACE adaptation for continuous learning.
 *
 * The OnlineACE processes samples sequentially as they arrive,
 * updating the skillbook after each one. This enables continuous
 * improvement during deployment, adapting to new patterns and
 * correcting mistakes in real-time.
 *
 * @example
 * ```typescript
 * import { OnlineACE, Agent, Reflector, SkillManager, Skillbook } from 'ace-ts';
 * import { VercelAIClient } from 'ace-ts';
 *
 * // Initialize with pre-trained skillbook
 * const skillbook = await Skillbook.loadFromFile("pretrained_skillbook.json");
 *
 * const client = new VercelAIClient({ model: 'gpt-4' });
 * const ace = new OnlineACE({
 *   skillbook,
 *   agent: new Agent(client),
 *   reflector: new Reflector(client),
 *   skillManager: new SkillManager(client)
 * });
 *
 * // Process streaming samples
 * async function* sampleStream() {
 *   while (true) {
 *     yield await getNextSample();  // Your sample source
 *   }
 * }
 *
 * // Run online adaptation
 * const results = await ace.run(await collectSamples(), environment);
 *
 * // Skillbook evolves with each sample
 * console.log(`Skills: ${ace.getSkillbook().skills().length}`);
 * ```
 *
 * Online vs Offline:
 * - Online: Processes each sample once, adapts immediately
 * - Offline: Processes fixed set multiple times for thorough learning
 * - Online is ideal for production deployment with continuous improvement
 * - Offline is ideal for initial training before deployment
 */
export class OnlineACE extends ACEBase {
  /**
   * Run online adaptation over a stream of samples.
   *
   * @param samples Iterable of samples
   * @param environment Environment for evaluating agent outputs
   * @returns List of ACEStepResult for each processed sample
   *
   * Note:
   * - Processes samples sequentially, updating after each one
   * - The skillbook evolves continuously during processing
   * - Can handle arrays or async iterables
   */
  async run(
    samples: Sample[],
    environment: TaskEnvironment
  ): Promise<ACEStepResult[]> {
    const results: ACEStepResult[] = [];

    let stepIdx = 0;
    for (const sample of samples) {
      stepIdx++;
      const result = await this.processSample(
        sample,
        environment,
        1, // epoch
        1, // totalEpochs
        stepIdx,
        stepIdx // totalSteps (unknown for streaming)
      );
      results.push(result);
    }

    return results;
  }
}
