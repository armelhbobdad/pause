/**
 * ACE Framework - TypeScript Port
 * Build self-improving AI agents that learn from experience
 */

// Adaptation loops
export type {
  ACEConfig,
  ACEStepResult,
  EnvironmentResult,
  OfflineACERunOptions,
  Sample,
  TaskEnvironment,
} from "./adaptation.js";
export { OfflineACE, OnlineACE, SimpleEnvironment } from "./adaptation.js";
// Async learning infrastructure
export type {
  AsyncLearningPipelineOptions,
  AsyncLearningPipelineStats,
  LearningTask,
  ReflectionResult,
} from "./async_learning.js";
export {
  AsyncLearningPipeline,
  ThreadSafeSkillbook,
} from "./async_learning.js";
// Deduplication system
export type {
  ConsolidationOperation,
  DeduplicationConfig,
  DeleteOp,
  EmbeddingProvider,
  KeepOp,
  MergeOp,
  UpdateOp,
} from "./deduplication/index.js";
export {
  applyConsolidationOperations,
  createDeduplicationConfig,
  DeduplicationManager,
  formatPairForLogging,
  generateSimilarityReport,
  SimilarityDetector,
} from "./deduplication/index.js";
// Feature detection utilities
export {
  clearFeatureCache,
  getAvailableFeatures,
  hasAnthropic,
  hasDotenv,
  hasGoogleAI,
  hasLangChain,
  hasOpenAI,
  hasPlaywright,
  hasPuppeteer,
  hasVercelAI,
  hasZod,
  printFeatureStatus,
} from "./features.js";
// Integration utilities for external agents
export { wrapSkillbookContext } from "./integrations/base.js";
// Simple integration class (similar to ACELiteLLM)
export { ACEAgent } from "./integrations/simple.js";
// LLM clients
export type { LLMClient, LLMResponse } from "./llm.js";
export { createLLMClient, DummyLLMClient, VercelAIClient } from "./llm.js";
// LLM Provider implementations
export type { VercelAIConfig } from "./llm_providers/index.js";
export {
  createVercelAIClient,
  VercelAIClient as VercelAIProviderClient,
} from "./llm_providers/index.js";
// Observability system (optional - requires 'opik' package)
export {
  aceTrack,
  configureOpik,
  getIntegration,
  maybeTrack,
  OPIK_AVAILABLE,
  OpikIntegration,
  trackRole,
} from "./observability/index.js";
// Prompts v1 (basic)
export {
  createAgentPrompt,
  createReflectorPrompt,
  createSkillManagerPrompt,
  SKILLBOOK_USAGE_INSTRUCTIONS,
  wrapSkillbookForExternalAgent,
} from "./prompts.js";
export type { PromptVersions, ValidationResult } from "./prompts_v2.js";
// Prompts v2 (advanced)
export {
  AGENT_CODE_PROMPT,
  AGENT_MATH_PROMPT,
  AGENT_V2_PROMPT,
  CURATOR_V2_PROMPT,
  GENERATOR_CODE_PROMPT,
  GENERATOR_MATH_PROMPT,
  GENERATOR_V2_PROMPT,
  MIGRATION_GUIDE,
  PromptManager,
  REFLECTOR_V2_PROMPT,
  SKILL_MANAGER_V2_PROMPT,
  validatePromptOutput,
} from "./prompts_v2.js";
// Prompts v2.1 (state-of-the-art - RECOMMENDED, +17% success rate)
export {
  AGENT_CODE_V2_1_PROMPT,
  AGENT_MATH_V2_1_PROMPT,
  AGENT_V2_1_PROMPT,
  comparePromptVersions,
  MIGRATION_GUIDE_V21,
  PromptManager as PromptManagerV21,
  REFLECTOR_V2_1_PROMPT,
  SKILL_MANAGER_V2_1_PROMPT,
  SKILLBOOK_USAGE_INSTRUCTIONS as SKILLBOOK_USAGE_INSTRUCTIONS_V21,
  validatePromptOutputV21,
  wrapSkillbookForExternalAgent as wrapSkillbookForExternalAgentV21,
} from "./prompts_v2_1.js";
// Roles
export type { AgentOutput, ReflectorOutput } from "./roles.js";
export {
  Agent,
  extractCitedSkillIds,
  Reflector,
  ReplayAgent,
  SkillManager,
} from "./roles.js";
// Core exports
export type { SimilarityDecision, Skill } from "./skillbook.js";
export { createSkill, Skillbook, skillToLLMDict } from "./skillbook.js";
export type { OperationType, UpdateBatch, UpdateOperation } from "./updates.js";
export {
  createUpdateBatch,
  createUpdateOperation,
  updateBatchFromJSON,
  updateBatchToJSON,
  updateOperationFromJSON,
  updateOperationToJSON,
} from "./updates.js";
