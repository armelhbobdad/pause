/**
 * Async learning infrastructure for ACE.
 *
 * This module provides parallel Reflector execution with serialized SkillManager
 * for efficient learning without skillbook conflicts.
 *
 * Architecture:
 *     Sample 1 ──► Agent ──► Env ──► Reflector ─┐
 *     Sample 2 ──► Agent ──► Env ──► Reflector ─┼──► [Queue] ──► SkillManager ──► Skillbook
 *     Sample 3 ──► Agent ──► Env ──► Reflector ─┘                (serialized)
 *                (parallel)        (parallel)
 */

import type { EnvironmentResult, Sample } from "./adaptation";
import type {
  AgentOutput,
  Reflector,
  ReflectorOutput,
  SkillManager,
} from "./roles";
import type { Skillbook } from "./skillbook";
import type { UpdateBatch } from "./updates";

// ---------------------------------------------------------------------------
// Data Classes
// ---------------------------------------------------------------------------

export interface LearningTask {
  /**
   * Input to Reflector (from main thread).
   *
   * Contains all data needed to run reflection on a sample's results.
   */
  sample: Sample;
  agentOutput: AgentOutput;
  environmentResult: EnvironmentResult;
  epoch: number;
  stepIndex: number;
  totalEpochs?: number;
  totalSteps?: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ReflectionResult {
  /**
   * Output from Reflector (goes to SkillManager queue).
   *
   * Contains the original task plus the reflection analysis.
   */
  task: LearningTask;
  reflection: ReflectorOutput;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Thread-Safe Skillbook Wrapper
// ---------------------------------------------------------------------------

/**
 * Thread-safe wrapper for Skillbook with RWLock semantics.
 *
 * Provides:
 * - Lock-free reads for eventual consistency (Agent can read anytime)
 * - Locked writes to ensure atomic skillbook updates (SkillManager serialized)
 *
 * Example:
 *     const tsSkillbook = new ThreadSafeSkillbook(skillbook);
 *     // Reads are lock-free
 *     const prompt = tsSkillbook.asPrompt();
 *     // Writes are locked
 *     tsSkillbook.applyUpdate(updateBatch);
 */
export class ThreadSafeSkillbook {
  private readonly _skillbook: Skillbook;
  private _lock: Promise<void> = Promise.resolve();

  constructor(skillbook: Skillbook) {
    this._skillbook = skillbook;
  }

  /**
   * Direct access to underlying skillbook (for read operations).
   */
  get skillbook(): Skillbook {
    return this._skillbook;
  }

  // -----------------------------------------------------------------------
  // Lock-free reads (eventual consistency)
  // -----------------------------------------------------------------------

  /**
   * Get TOON-encoded skillbook for LLM prompts (lock-free).
   */
  asPrompt(): string {
    return this._skillbook.asPrompt();
  }

  /**
   * Get all skills (lock-free).
   */
  skills(): any[] {
    return this._skillbook.skills();
  }

  /**
   * Get a skill by ID (lock-free).
   */
  getSkill(skillId: string): any | null {
    return this._skillbook.getSkill(skillId);
  }

  /**
   * Get skillbook statistics (lock-free).
   */
  stats(): Record<string, any> {
    return this._skillbook.stats();
  }

  // -----------------------------------------------------------------------
  // Locked writes (serialized for thread safety)
  // -----------------------------------------------------------------------

  /**
   * Apply update operations to skillbook (thread-safe).
   */
  async applyUpdate(update: UpdateBatch): Promise<void> {
    await this._withLock(async () => {
      this._skillbook.applyUpdate(update);
    });
  }

  /**
   * Tag a skill (thread-safe).
   */
  async tagSkill(
    skillId: string,
    tag: string,
    increment = 1
  ): Promise<any | null> {
    return await this._withLock(async () => {
      return this._skillbook.tagSkill(skillId, tag, increment);
    });
  }

  /**
   * Add a skill (thread-safe).
   */
  async addSkill(
    section: string,
    content: string,
    skillId?: string,
    metadata?: Record<string, number>
  ): Promise<any> {
    return await this._withLock(async () => {
      return this._skillbook.addSkill(section, content, skillId, metadata);
    });
  }

  /**
   * Update a skill (thread-safe).
   */
  async updateSkill(
    skillId: string,
    options: {
      content?: string;
      metadata?: Record<string, number>;
    }
  ): Promise<any | null> {
    return await this._withLock(async () => {
      return this._skillbook.updateSkill(skillId, options);
    });
  }

  /**
   * Remove a skill (thread-safe).
   */
  async removeSkill(skillId: string): Promise<void> {
    await this._withLock(async () => {
      this._skillbook.removeSkill(skillId);
    });
  }

  /**
   * Execute a function with lock held.
   */
  private async _withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const previousLock = this._lock;
    let resolveLock: (() => void) | undefined;
    this._lock = new Promise((resolve) => {
      resolveLock = resolve;
    });

    try {
      await previousLock;
      return await fn();
    } finally {
      resolveLock?.();
    }
  }
}

// ---------------------------------------------------------------------------
// Async Learning Pipeline
// ---------------------------------------------------------------------------

export interface AsyncLearningPipelineOptions {
  /** Skillbook instance to update */
  skillbook: Skillbook;
  /** Reflector instance for analysis */
  reflector: Reflector;
  /** SkillManager instance for skillbook updates */
  skillManager: SkillManager;
  /** Max concurrent Reflector workers (default: 3) */
  maxReflectorWorkers?: number;
  /** Max pending SkillManager tasks (default: 100) */
  skillManagerQueueSize?: number;
  /** Reflector refinement rounds (default: 1) */
  maxRefinementRounds?: number;
  /** Callback for task errors */
  onError?: (error: Error, task: LearningTask) => void;
  /** Callback for task completion */
  onComplete?: (task: LearningTask, skillManagerOutput: any) => void;
}

export interface AsyncLearningPipelineStats {
  tasksSubmitted: number;
  reflectionsCompleted: number;
  skillUpdatesCompleted: number;
  tasksFailed: number;
  skillManagerQueueSize: number;
  isRunning: boolean;
}

/**
 * Parallel Reflectors + Serialized SkillManager pipeline.
 *
 * This class orchestrates async learning with:
 * 1. Promise.all for parallel Reflector.reflect() calls
 * 2. Single SkillManager processing queue sequentially
 * 3. Thread-safe skillbook wrapper for safe concurrent access
 *
 * Flow:
 *     1. Main thread submits LearningTask via submit()
 *     2. Promises run Reflector.reflect() in parallel
 *     3. ReflectionResult queued to SkillManager
 *     4. Single SkillManager processes queue sequentially
 *
 * Example:
 *     const pipeline = new AsyncLearningPipeline({
 *       skillbook,
 *       reflector,
 *       skillManager,
 *       maxReflectorWorkers: 3,
 *     });
 *     pipeline.start();
 *     pipeline.submit(task);  // Non-blocking
 *     await pipeline.waitForCompletion();
 *     pipeline.stop();
 */
export class AsyncLearningPipeline {
  private readonly _skillbook: ThreadSafeSkillbook;
  private readonly _reflector: Reflector;
  private readonly _skillManager: SkillManager;
  private readonly _maxReflectorWorkers: number;
  private readonly _onError?: (error: Error, task: LearningTask) => void;
  private readonly _onComplete?: (
    task: LearningTask,
    skillManagerOutput: any
  ) => void;

  // Queue for SkillManager (serialized processing)
  private readonly _skillManagerQueue: ReflectionResult[] = [];
  private readonly _skillManagerQueueSize: number;

  // Processing state
  private _isRunning = false;
  private _stopRequested = false;
  private _skillManagerProcessor: Promise<void> | null = null;

  // Stats
  private _tasksSubmitted = 0;
  private _reflectionsCompleted = 0;
  private _skillUpdatesCompleted = 0;
  private _tasksFailed = 0;

  // Track pending promises for wait_for_completion
  private readonly _pendingPromises: Set<Promise<void>> = new Set();

  // Semaphore for limiting concurrent reflectors
  private _activeReflectors = 0;
  private readonly _reflectorSemaphore: Promise<void>[] = [];

  constructor(options: AsyncLearningPipelineOptions) {
    this._skillbook = new ThreadSafeSkillbook(options.skillbook);
    this._reflector = options.reflector;
    this._skillManager = options.skillManager;
    this._maxReflectorWorkers = options.maxReflectorWorkers ?? 3;
    this._skillManagerQueueSize = options.skillManagerQueueSize ?? 100;
    this._onError = options.onError;
    this._onComplete = options.onComplete;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the async learning pipeline.
   */
  start(): void {
    if (this._isRunning) {
      console.warn("AsyncLearningPipeline already started");
      return;
    }

    this._stopRequested = false;
    this._isRunning = true;

    // Start SkillManager processing loop
    this._skillManagerProcessor = this._skillManagerLoop();

    console.log(
      `AsyncLearningPipeline started with ${this._maxReflectorWorkers} Reflector workers`
    );
  }

  /**
   * Stop the async learning pipeline.
   *
   * @param wait - If true, wait for pending tasks to complete
   * @param timeout - Max seconds to wait for completion
   * @returns Number of tasks remaining in queues
   */
  async stop(wait = true, timeout = 30.0): Promise<number> {
    if (!this._isRunning) {
      return 0;
    }

    if (wait) {
      await this.waitForCompletion(timeout);
    }

    // Signal stop
    this._stopRequested = true;
    this._isRunning = false;

    // Wait for SkillManager processor to finish
    if (this._skillManagerProcessor) {
      await this._skillManagerProcessor;
      this._skillManagerProcessor = null;
    }

    const remaining = this._skillManagerQueue.length;
    console.log(`AsyncLearningPipeline stopped, ${remaining} tasks remaining`);
    return remaining;
  }

  /**
   * Check if the pipeline is running.
   */
  isRunning(): boolean {
    return this._isRunning && !this._stopRequested;
  }

  // -----------------------------------------------------------------------
  // Task Submission
  // -----------------------------------------------------------------------

  /**
   * Submit a learning task (non-blocking).
   *
   * @param task - LearningTask containing sample results to learn from
   * @returns Promise for tracking completion, or null if pipeline not running
   */
  submit(task: LearningTask): Promise<void> | null {
    if (!this._isRunning) {
      console.warn("Cannot submit task: pipeline not started");
      return null;
    }

    this._tasksSubmitted++;

    // Create promise for Reflector processing
    const promise = this._reflectorWorker(task);

    // Track promise for wait_for_completion
    this._pendingPromises.add(promise);
    promise.finally(() => {
      this._pendingPromises.delete(promise);
    });

    return promise;
  }

  // -----------------------------------------------------------------------
  // Synchronization
  // -----------------------------------------------------------------------

  /**
   * Wait for all pending learning tasks to complete.
   *
   * @param timeout - Max seconds to wait (undefined = wait forever)
   * @returns True if all tasks completed, False if timeout
   */
  async waitForCompletion(timeout?: number): Promise<boolean> {
    const startTime = Date.now();

    // Wait for all Reflector promises to complete
    const pending = Array.from(this._pendingPromises);

    for (const promise of pending) {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = timeout !== undefined ? timeout - elapsed : undefined;

      if (remaining !== undefined && remaining <= 0) {
        return false;
      }

      try {
        if (remaining !== undefined) {
          await Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), remaining * 1000)
            ),
          ]);
        } else {
          await promise;
        }
      } catch (_error) {
        // Errors already handled in worker
      }
    }

    // Wait for SkillManager queue to drain
    const pollStart = Date.now();
    while (this._skillManagerQueue.length > 0) {
      if (timeout !== undefined) {
        const elapsed = (Date.now() - pollStart) / 1000;
        if (elapsed > timeout) {
          return false;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return true;
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  /**
   * Get pipeline statistics.
   */
  get stats(): AsyncLearningPipelineStats {
    return {
      tasksSubmitted: this._tasksSubmitted,
      reflectionsCompleted: this._reflectionsCompleted,
      skillUpdatesCompleted: this._skillUpdatesCompleted,
      tasksFailed: this._tasksFailed,
      skillManagerQueueSize: this._skillManagerQueue.length,
      isRunning: this.isRunning(),
    };
  }

  // -----------------------------------------------------------------------
  // Internal Workers
  // -----------------------------------------------------------------------

  /**
   * Run Reflector.reflect() - executes as async task.
   *
   * Can have multiple instances running concurrently.
   */
  private async _reflectorWorker(task: LearningTask): Promise<void> {
    // Acquire semaphore slot
    await this._acquireReflectorSlot();

    try {
      // Run reflection (safe to parallelize - reads only)
      const reflection = await this._reflector.reflect({
        question: task.sample.question,
        generatorAnswer: task.agentOutput.final_answer,
        feedback: task.environmentResult.feedback,
        groundTruth: task.environmentResult.groundTruth,
        skillbook: this._skillbook.skillbook, // Read-only access
      });

      // Create result
      const result: ReflectionResult = {
        task,
        reflection,
        timestamp: Date.now(),
      };

      // Queue for SkillManager
      if (this._skillManagerQueue.length >= this._skillManagerQueueSize) {
        console.warn(
          `SkillManager queue full, dropping reflection for sample ${task.stepIndex}`
        );
        this._tasksFailed++;
        return;
      }

      this._skillManagerQueue.push(result);
      this._reflectionsCompleted++;
    } catch (error) {
      console.warn(`Reflector failed for sample ${task.stepIndex}: ${error}`);
      this._tasksFailed++;

      if (this._onError && error instanceof Error) {
        try {
          this._onError(error, task);
        } catch {
          // Don't let callback errors propagate
        }
      }
    } finally {
      // Release semaphore slot
      this._releaseReflectorSlot();
    }
  }

  /**
   * Acquire a reflector slot (semaphore).
   */
  private async _acquireReflectorSlot(): Promise<void> {
    while (this._activeReflectors >= this._maxReflectorWorkers) {
      // Wait for a slot to free up
      await new Promise((resolve) => {
        this._reflectorSemaphore.push(Promise.resolve().then(resolve));
      });
    }
    this._activeReflectors++;
  }

  /**
   * Release a reflector slot (semaphore).
   */
  private _releaseReflectorSlot(): void {
    this._activeReflectors--;
    const waiting = this._reflectorSemaphore.shift();
    if (waiting) {
      // Signal waiting task
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional — resolve semaphore slot
      waiting.then(() => {});
    }
  }

  /**
   * Single SkillManager loop - processes ReflectionResults sequentially.
   *
   * Only one instance runs at a time to serialize skillbook updates.
   */
  private async _skillManagerLoop(): Promise<void> {
    while (!this._stopRequested) {
      // Check for queued results
      const result = this._skillManagerQueue.shift();

      if (!result) {
        // No work, sleep briefly
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      try {
        await this._processSkillUpdate(result);
      } catch (error) {
        console.warn(
          `SkillManager failed for sample ${result.task.stepIndex}: ${error}`
        );
        this._tasksFailed++;

        if (this._onError && error instanceof Error) {
          try {
            this._onError(error, result.task);
          } catch {
            // Don't let callback errors propagate
          }
        }
      }
    }
  }

  /**
   * Process a single reflection result through SkillManager.
   *
   * Runs in the single SkillManager loop - serialized execution.
   */
  private async _processSkillUpdate(result: ReflectionResult): Promise<void> {
    const task = result.task;
    const reflection = result.reflection;

    // Apply skill tags (thread-safe)
    // Tag helpful skills
    for (const skillId of reflection.helpful_skill_ids) {
      try {
        await this._skillbook.tagSkill(skillId, "helpful");
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional — skip unknown skill IDs silently
      } catch {}
    }
    // Tag harmful skills
    for (const skillId of reflection.harmful_skill_ids) {
      try {
        await this._skillbook.tagSkill(skillId, "harmful");
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional — skip unknown skill IDs silently
      } catch {}
    }

    // Run SkillManager (sees latest skillbook state)
    const updateBatch = await this._skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook: this._skillbook.skillbook, // Pass underlying skillbook
    });

    // Apply update (thread-safe)
    await this._skillbook.applyUpdate(updateBatch);

    this._skillUpdatesCompleted++;

    // Completion callback
    if (this._onComplete) {
      try {
        this._onComplete(task, updateBatch);
      } catch {
        // Don't let callback errors propagate
      }
    }
  }
}
