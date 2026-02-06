/**
 * Opik Integration for ACE Framework
 *
 * Provides enterprise-grade observability and tracing for ACE components.
 * Replaces custom explainability with production-ready Opik platform.
 */

// Optional Opik types and client
let Opik: any = null;
let opikContext: any = null;
let OPIK_AVAILABLE = false;

try {
  const opikModule = await import("opik");
  Opik = opikModule.Opik;
  opikContext = (opikModule as any).opikContext ?? null;
  OPIK_AVAILABLE = true;
} catch {
  // Opik not installed - graceful degradation
  OPIK_AVAILABLE = false;
}

/**
 * Check if Opik should be disabled via environment variable.
 *
 * Supports both patterns:
 * - OPIK_DISABLED=true/1/yes (disable pattern)
 * - OPIK_ENABLED=false/0/no (enable pattern)
 */
function _shouldSkipOpik(): boolean {
  // Check disable pattern: OPIK_DISABLED=true/1/yes
  const disabled = process.env.OPIK_DISABLED?.toLowerCase();
  if (disabled === "true" || disabled === "1" || disabled === "yes") {
    return true;
  }

  // Check enable pattern: OPIK_ENABLED=false/0/no
  const enabled = process.env.OPIK_ENABLED?.toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") {
    return true;
  }

  return false;
}

/**
 * Main integration class for ACE + Opik observability.
 *
 * Provides enterprise-grade tracing, evaluation, and monitoring
 * capabilities for ACE framework components.
 */
export class OpikIntegration {
  projectName: string;
  tags: string[];
  enabled: boolean;
  private readonly client: any = null;

  constructor(
    projectName = "ace-framework",
    enableAutoConfig = true,
    tags?: string[]
  ) {
    this.projectName = projectName;
    this.tags = tags || ["ace-framework"];
    // Check both OPIK_AVAILABLE and env var before enabling
    this.enabled = OPIK_AVAILABLE && !_shouldSkipOpik();

    if (this.enabled && enableAutoConfig) {
      try {
        // Configure Opik client for local or cloud use
        process.env.OPIK_URL_OVERRIDE =
          process.env.OPIK_URL_OVERRIDE || "http://localhost:5173/api";
        process.env.OPIK_WORKSPACE = process.env.OPIK_WORKSPACE || "default";

        this.client = new Opik({
          projectName: this.projectName,
        });

        console.info(`Opik configured for project: ${projectName}`);
      } catch (e) {
        console.debug(
          `Opik configuration skipped: ${e instanceof Error ? e.message : String(e)}`
        );
        this.enabled = false;
      }
    } else if (!OPIK_AVAILABLE) {
      console.debug(
        "Opik not available. Install with: npm install opik (optional)"
      );
    }
  }

  /**
   * Log skill evolution metrics to Opik.
   */
  logSkillEvolution(
    skillId: string,
    skillContent: string,
    helpfulCount: number,
    harmfulCount: number,
    neutralCount: number,
    section: string,
    metadata?: Record<string, any>
  ): void {
    if (!(this.enabled && opikContext)) {
      return;
    }

    try {
      // Calculate effectiveness score
      const totalVotes = helpfulCount + harmfulCount + neutralCount;
      const effectiveness = totalVotes > 0 ? helpfulCount / totalVotes : 0.0;

      // Update current trace with skill metrics
      opikContext.updateCurrentTrace({
        feedbackScores: [
          {
            name: "skill_effectiveness",
            value: effectiveness,
            reason: `Skill ${skillId}: ${helpfulCount}H/${harmfulCount}H/${neutralCount}N`,
          },
        ],
        metadata: {
          skill_id: skillId,
          skill_content: skillContent,
          section,
          helpful_count: helpfulCount,
          harmful_count: harmfulCount,
          neutral_count: neutralCount,
          total_votes: totalVotes,
          ...(metadata || {}),
        },
        tags: [...this.tags, "skill-evolution"],
      });
    } catch (e) {
      console.error(
        `Failed to log skill evolution: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Log skillbook update metrics to Opik.
   */
  logSkillbookUpdate(
    operationType: string,
    skillsAdded = 0,
    skillsUpdated = 0,
    skillsRemoved = 0,
    totalSkills = 0,
    metadata?: Record<string, any>
  ): void {
    if (!(this.enabled && opikContext)) {
      return;
    }

    try {
      opikContext.updateCurrentTrace({
        feedbackScores: [
          {
            name: "skillbook_size",
            value: totalSkills,
            reason: `Skillbook contains ${totalSkills} skills after ${operationType}`,
          },
        ],
        metadata: {
          operation_type: operationType,
          skills_added: skillsAdded,
          skills_updated: skillsUpdated,
          skills_removed: skillsRemoved,
          total_skills: totalSkills,
          ...(metadata || {}),
        },
        tags: [...this.tags, "skillbook-update"],
      });
    } catch (e) {
      console.error(
        `Failed to log skillbook update: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Log ACE role performance metrics.
   */
  logRolePerformance(
    roleName: string,
    executionTime: number,
    success: boolean,
    inputData?: Record<string, any>,
    outputData?: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    if (!(this.enabled && opikContext)) {
      return;
    }

    try {
      opikContext.updateCurrentTrace({
        feedbackScores: [
          {
            name: "role_success",
            value: success ? 1.0 : 0.0,
            reason: `${roleName} ${success ? "succeeded" : "failed"} in ${executionTime.toFixed(2)}s`,
          },
          {
            name: "execution_time",
            value: executionTime,
            reason: `${roleName} execution time in seconds`,
          },
        ],
        metadata: {
          role_name: roleName,
          execution_time: executionTime,
          success,
          input_data: inputData,
          output_data: outputData,
          ...(metadata || {}),
        },
        tags: [...this.tags, `role-${roleName.toLowerCase()}`],
      });
    } catch (e) {
      console.error(
        `Failed to log role performance: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Log adaptation training metrics.
   */
  logAdaptationMetrics(
    epoch: number,
    step: number,
    performanceScore: number,
    skillCount: number,
    successfulPredictions: number,
    totalPredictions: number,
    metadata?: Record<string, any>
  ): void {
    if (!(this.enabled && opikContext)) {
      return;
    }

    try {
      const accuracy =
        totalPredictions > 0 ? successfulPredictions / totalPredictions : 0.0;

      opikContext.updateCurrentTrace({
        feedbackScores: [
          {
            name: "performance_score",
            value: performanceScore,
            reason: `Epoch ${epoch}, Step ${step} performance`,
          },
          {
            name: "accuracy",
            value: accuracy,
            reason: `Accuracy: ${successfulPredictions}/${totalPredictions}`,
          },
        ],
        metadata: {
          epoch,
          step,
          performance_score: performanceScore,
          skill_count: skillCount,
          successful_predictions: successfulPredictions,
          total_predictions: totalPredictions,
          accuracy,
          ...(metadata || {}),
        },
        tags: [...this.tags, "adaptation-training"],
      });
    } catch (e) {
      console.error(
        `Failed to log adaptation metrics: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Create an Opik experiment for evaluation.
   */
  createExperiment(
    name: string,
    description = "",
    metadata?: Record<string, any>
  ): void {
    if (!(this.enabled && opikContext)) {
      return;
    }

    try {
      // Opik experiments are automatically created when logging
      // We'll use trace metadata to organize experiments
      opikContext.updateCurrentTrace({
        metadata: {
          experiment_name: name,
          experiment_description: description,
          experiment_timestamp: new Date().toISOString(),
          ...(metadata || {}),
        },
        tags: [...this.tags, "experiment", `exp-${name}`],
      });
      console.info(`Opik experiment created: ${name}`);
    } catch (e) {
      console.error(
        `Failed to create experiment: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Set up Vercel AI SDK callback for automatic token and cost tracking.
   *
   * Note: TypeScript version doesn't have direct LiteLLM integration.
   * This method is a placeholder for future Vercel AI SDK integration.
   *
   * @returns True if callback was successfully configured, false otherwise
   */
  setupVercelAICallback(): boolean {
    if (!this.enabled) {
      return false;
    }

    try {
      // Vercel AI SDK has built-in telemetry support
      // This would require custom middleware integration
      console.info(
        "Vercel AI SDK callback setup - requires custom telemetry middleware"
      );
      return true;
    } catch (e) {
      console.error(
        `Failed to setup Vercel AI callback: ${e instanceof Error ? e.message : String(e)}`
      );
      return false;
    }
  }

  /**
   * Check if Opik integration is available and configured.
   */
  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Check if Vercel AI integration is available.
   */
  isVercelAIIntegrationAvailable(): boolean {
    // Placeholder - would need to check for Vercel AI SDK
    return false;
  }

  /**
   * Flush any pending traces to Opik.
   */
  async flush(): Promise<void> {
    if (!(this.enabled && this.client)) {
      return;
    }

    try {
      await this.client.flush();
    } catch (e) {
      console.error(
        `Failed to flush Opik traces: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

// Global integration instance
let _globalIntegration: OpikIntegration | null = null;

/**
 * Get or create global Opik integration instance.
 */
export function getIntegration(): OpikIntegration {
  if (_globalIntegration === null) {
    if (_shouldSkipOpik()) {
      // Return disabled integration
      _globalIntegration = new OpikIntegration(
        "ace-framework",
        false,
        undefined
      );
      _globalIntegration.enabled = false;
    } else {
      _globalIntegration = new OpikIntegration();
    }
  }
  return _globalIntegration;
}

/**
 * Configure global Opik integration.
 */
export function configureOpik(
  projectName = "ace-framework",
  tags?: string[]
): OpikIntegration {
  if (_shouldSkipOpik()) {
    // Return disabled integration when OPIK_DISABLED is set
    console.debug(
      "Opik configuration skipped via OPIK_DISABLED environment variable"
    );
    _globalIntegration = new OpikIntegration(projectName, false, tags);
    _globalIntegration.enabled = false;
  } else {
    _globalIntegration = new OpikIntegration(projectName, true, tags);
  }
  return _globalIntegration;
}

// Export availability flag for feature detection
export { OPIK_AVAILABLE };
