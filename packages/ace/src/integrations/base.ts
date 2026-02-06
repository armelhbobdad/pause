/**
 * Base classes and utilities for ACE integrations with external agentic frameworks.
 *
 * This module provides the foundation for integrating ACE learning capabilities
 * with external agentic systems like browser automation, LangChain, custom agents, and more.
 *
 * ## When to Use Integrations vs Full ACE Pipeline
 *
 * ### Use INTEGRATIONS (this module) when:
 * - You have an existing agentic system (browser automation, LangChain, custom agent)
 * - The external agent handles task execution
 * - You want ACE to learn from that agent's results
 * - Example: Browser automation, LangChain chains, API-based agents
 *
 * ### Use FULL ACE PIPELINE when:
 * - Building a new agent from scratch
 * - Want ACE Agent to handle task execution
 * - Simple Q&A, classification, reasoning tasks
 * - Example: Question answering, data extraction, summarization
 *
 * ## Integration Pattern (Three Steps)
 *
 * The integration pattern allows external agents to benefit from ACE learning
 * without replacing their execution logic:
 *
 *     1. INJECT: Add skillbook context to agent's input (optional)
 *        → wrapSkillbookContext(skillbook) formats learned strategies
 *
 *     2. EXECUTE: External agent runs normally
 *        → Your framework handles the task (browser automation, LangChain, etc.)
 *
 *     3. LEARN: ACE analyzes results and updates skillbook
 *        → Reflector: Analyzes what worked/failed
 *        → SkillManager: Updates skillbook with new strategies
 *
 * ## Why No ACE Agent?
 *
 * Integrations bypass ACE's Agent because:
 * - External frameworks have their own execution logic
 * - They may use tools, browsers, or specialized workflows
 * - ACE focuses on LEARNING from their results, not replacing them
 *
 * ## Basic Example
 *
 * ```typescript
 * import { wrapSkillbookContext } from '@kayba/ace-framework/integrations/base';
 * import { Skillbook, Reflector, SkillManager, VercelAIClient } from '@kayba/ace-framework';
 * import { openai } from '@ai-sdk/openai';
 *
 * // Setup
 * const skillbook = new Skillbook();
 * const llmClient = new VercelAIClient({ model: openai('gpt-4o-mini') });
 * const reflector = new Reflector(llmClient);
 * const skillManager = new SkillManager(llmClient);
 *
 * // 1. INJECT: Add learned strategies to task (optional)
 * let task = "Process user request";
 * if (skillbook.skills().length > 0) {
 *   const context = wrapSkillbookContext(skillbook);
 *   task = `${task}\n\n${context}`;
 * }
 *
 * // 2. EXECUTE: Your agent runs
 * const result = await yourAgent.execute(task);
 *
 * // 3. LEARN: ACE learns from results
 * const reflection = await reflector.reflect({
 *   question: task,
 *   generatorAnswer: result.output,
 *   feedback: result.success ? 'Task succeeded' : 'Task failed',
 *   skillbook: skillbook
 * });
 *
 * const updates = await skillManager.curate({
 *   reflectionAnalysis: reflection.analysis,
 *   skillbook: skillbook
 * });
 *
 * skillbook.applyUpdate(updates);
 * skillbook.saveToFile('learned.json');
 * ```
 *
 * ## See Also
 *
 * - Simple integration: ACEAgent (examples/simple-example.ts)
 * - Full training loops: OfflineACE, OnlineACE (adaptation.ts)
 */

import { wrapSkillbookForExternalAgent } from "../prompts.js";
import type { Skillbook } from "../skillbook.js";

/**
 * Wrap skillbook skills with explanation for external agents.
 *
 * This helper formats learned strategies from the skillbook with instructions
 * on how to apply them. Delegates to the canonical implementation in
 * prompts module to ensure consistency across all ACE components.
 *
 * The formatted output includes:
 * - Header explaining these are learned strategies
 * - List of skills with success rates (helpful/harmful scores)
 * - Usage instructions on how to apply strategies
 * - Reminder that these are patterns, not rigid rules
 *
 * @param skillbook - Skillbook with learned strategies
 * @returns Formatted text explaining skillbook and listing strategies.
 *          Returns empty string if skillbook has no skills.
 *
 * @example
 * Basic usage with any agent:
 * ```typescript
 * const skillbook = new Skillbook();
 * skillbook.addSkill('general', 'Always verify inputs');
 * const context = wrapSkillbookContext(skillbook);
 * const enhancedTask = `${task}\n\n${context}`;
 * const result = await yourAgent.execute(enhancedTask);
 * ```
 *
 * @example
 * With browser automation:
 * ```typescript
 * import { wrapSkillbookContext } from '@kayba/ace-framework/integrations/base';
 * const task = "Find top HN post";
 * const enhancedTask = `${task}\n\n${wrapSkillbookContext(skillbook)}`;
 * await browserAgent.run(enhancedTask);
 * ```
 *
 * @example
 * With LangChain:
 * ```typescript
 * const context = wrapSkillbookContext(skillbook);
 * await chain.invoke({ input: task, context: context });
 * ```
 *
 * @example
 * With API-based agents:
 * ```typescript
 * const payload = {
 *   task: task,
 *   strategies: wrapSkillbookContext(skillbook)
 * };
 * const response = await apiClient.post('/execute', payload);
 * ```
 *
 * @example
 * Conditional injection (skip if empty):
 * ```typescript
 * let finalTask = task;
 * if (skillbook.skills().length > 0) {
 *   finalTask = `${task}\n\n${wrapSkillbookContext(skillbook)}`;
 * }
 * // task unchanged if no learned strategies yet
 * ```
 *
 * Integration Patterns:
 *   1. String Concatenation (most common):
 *      enhancedTask = `${task}\n\n${context}`
 *
 *   2. Object/Params Injection:
 *      chain.invoke({ input: task, learnedStrategies: context })
 *
 *   3. System Message Injection:
 *      messages = [
 *        { role: "system", content: context },
 *        { role: "user", content: task }
 *      ]
 *
 *   4. Tool Description Enhancement:
 *      tool.description += `\n\nLearned patterns: ${context}`
 *
 * Note:
 *   This function delegates to wrapSkillbookForExternalAgent() in
 *   prompts module, which is the single source of truth for
 *   skillbook presentation. Kept here for convenience and discoverability.
 */
export function wrapSkillbookContext(skillbook: Skillbook): string {
  return wrapSkillbookForExternalAgent(skillbook);
}
