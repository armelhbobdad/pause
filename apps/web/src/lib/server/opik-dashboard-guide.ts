import "server-only";

/**
 * Opik Dashboard configuration and URL helpers for judge access.
 *
 * This module provides constants and utilities for judges/reviewers
 * to access the Opik dashboard and apply filters to trace data.
 *
 * The Opik dashboard is hosted by Comet.com at:
 *   https://www.comet.com/opik/{workspace}/{project}/traces
 *
 * Public/shared access must be configured manually in the Comet.com UI
 * under workspace settings. No authentication beyond the shared link
 * is required for judge access (NFR-O6).
 *
 * @see Story 8.5a — Judge Dashboard Access & Layout (FR34, NFR-O4, NFR-O6)
 */

/**
 * Core dashboard configuration derived from environment variables.
 *
 * - `projectName`: The Opik project name (matches `getOpikClient()` in opik.ts)
 * - `workspaceName`: The Opik workspace (must match OPIK_WORKSPACE env var)
 * - `tags`: Tags attached to all Guardian traces via OpikExporter in instrumentation.ts
 * - `baseUrl`: Root URL for the Opik dashboard on Comet.com
 */
export const DASHBOARD_CONFIG = {
  projectName: process.env.OPIK_PROJECT_NAME ?? "pause",
  workspaceName: process.env.OPIK_WORKSPACE ?? "default",
  tags: ["hackathon", "pause"],
  baseUrl: "https://www.comet.com/opik",
} as const;

/**
 * Returns the full Opik dashboard URL for the configured project.
 *
 * Example: `https://www.comet.com/opik/default/pause/traces`
 */
export function getDashboardUrl(): string {
  const { baseUrl, workspaceName, projectName } = DASHBOARD_CONFIG;
  return `${baseUrl}/${workspaceName}/${projectName}/traces`;
}

/**
 * Returns a dashboard URL with an OQL filter parameter appended.
 *
 * @param filter - An OQL filter string (e.g., from FILTER_PATTERNS)
 * @returns Full URL with `?filters=` query parameter (URI-encoded)
 *
 * Example: `getFilteredUrl('name starts_with "guardian:therapist:"')`
 * Returns: `https://www.comet.com/opik/default/pause/traces?filters=name%20starts_with%20%22guardian%3Atherapist%3A%22`
 */
export function getFilteredUrl(filter: string): string {
  const base = getDashboardUrl();
  return `${base}?filters=${encodeURIComponent(filter)}`;
}

/**
 * OQL filter patterns for common dashboard queries (FR34, AC#5).
 *
 * These patterns use Opik Query Language (OQL) syntax. Key operators:
 * - `starts_with` — prefix match on trace name
 * - `ends_with` — suffix match on trace name
 *
 * If `starts_with`/`ends_with` are not available in the Opik dashboard UI,
 * judges can use explicit enumeration as a fallback (see Dev Notes in story file).
 */
export const FILTER_PATTERNS = {
  ANALYST_ONLY: 'name starts_with "guardian:analyst:"',
  NEGOTIATOR_ONLY: 'name starts_with "guardian:negotiator:"',
  THERAPIST_ONLY: 'name starts_with "guardian:therapist:"',
  OVERRIDES_ONLY: 'name ends_with ":override"',
  LEARNING_ONLY: 'name starts_with "learning:"',
  SYSTEM_FAILURES: 'name starts_with "system:failure:"',
} as const;

/**
 * Core metric definitions for the Opik dashboard summary view (AC#3).
 *
 * These describe the key metrics judges should monitor.
 * Metric values are derived from Opik feedback scores attached in Stories 8-3.
 */
export const METRIC_DEFINITIONS = {
  acceptance_rate:
    "Average intervention_acceptance score across traces with feedback",
  regret_free_rate:
    "Average regret_free_spending score across traces with satisfaction feedback",
  total_traces: "Count of all guardian:* traces",
  override_rate: "Count of *:override traces / total guardian traces",
} as const;

/**
 * Documentation constant describing how to trace a learning cycle
 * in the Opik dashboard (Story 8.5b, AC#3, AC#7).
 *
 * Judges can follow these steps to verify cause-and-effect learning
 * from a single override interaction through to strategy adjustment.
 */
export const LEARNING_SEQUENCE = {
  description: "How to trace a learning cycle in the Opik dashboard",
  steps: [
    "1. Find a guardian:*:override trace (user rejected strategy)",
    "2. Note the interactionId in trace metadata",
    "3. Filter learning traces by same interactionId",
    "4. View learning:reflection — see harmful_skill_ids",
    "5. View learning:skillbook_update — see TAG/REMOVE operations",
    "6. Find next guardian:* trace for same user — see different strategy used",
  ],
  filterPattern: 'metadata.interactionId = "{interactionId}"',
  timeToExplain: "<60 seconds",
} as const;

/**
 * OQL filter patterns for common learning-related dashboard queries
 * (Story 8.5b, AC#7).
 *
 * Provides quick-access filters for judges to isolate learning traces
 * by type or by interaction linkage.
 */
export const LEARNING_FILTER_PATTERNS = {
  ALL_LEARNING: 'name starts_with "learning:"',
  REFLECTIONS_ONLY: 'name = "learning:reflection"',
  SKILLBOOK_UPDATES_ONLY: 'name = "learning:skillbook_update"',
  SATISFACTION_ONLY: 'name = "learning:satisfaction_feedback"',
  BY_INTERACTION: (id: string) => `metadata.interactionId = "${id}"`,
} as const;
