/**
 * Guardian trace name constants and shared type.
 *
 * This file is intentionally NOT under lib/server/ — the TraceName type
 * must be importable by both server code (Opik trace naming) and any
 * client code that needs trace name awareness. Contains zero runtime
 * logic beyond a const object.
 *
 * Follows the same pattern as tool-names.ts.
 *
 * @see Story 8.1 — Trace Naming Convention (FR31, NFR-O1)
 */

export type TraceName =
  | "guardian:analyst:auto_approved"
  | "guardian:negotiator:accepted_savings"
  | "guardian:negotiator:skipped_savings"
  | "guardian:negotiator:accepted"
  | "guardian:negotiator:override"
  | "guardian:therapist:wait"
  | "guardian:therapist:accepted"
  | "guardian:therapist:override"
  | "guardian:therapist:wizard_bookmark"
  | "guardian:therapist:wizard_abandoned"
  | "guardian:break_glass"
  | "system:failure:analyst_only"
  | "system:failure:break_glass"
  | "learning:reflection"
  | "learning:skillbook_update";

export const TRACE_NAMES = {
  ANALYST_AUTO_APPROVED: "guardian:analyst:auto_approved",
  NEGOTIATOR_ACCEPTED_SAVINGS: "guardian:negotiator:accepted_savings",
  NEGOTIATOR_SKIPPED_SAVINGS: "guardian:negotiator:skipped_savings",
  NEGOTIATOR_ACCEPTED: "guardian:negotiator:accepted",
  NEGOTIATOR_OVERRIDE: "guardian:negotiator:override",
  THERAPIST_WAIT: "guardian:therapist:wait",
  THERAPIST_ACCEPTED: "guardian:therapist:accepted",
  THERAPIST_OVERRIDE: "guardian:therapist:override",
  THERAPIST_WIZARD_BOOKMARK: "guardian:therapist:wizard_bookmark",
  THERAPIST_WIZARD_ABANDONED: "guardian:therapist:wizard_abandoned",
  BREAK_GLASS: "guardian:break_glass",
  SYSTEM_FAILURE_ANALYST_ONLY: "system:failure:analyst_only",
  SYSTEM_FAILURE_BREAK_GLASS: "system:failure:break_glass",
  LEARNING_REFLECTION: "learning:reflection",
  LEARNING_SKILLBOOK_UPDATE: "learning:skillbook_update",
} as const satisfies Record<string, TraceName>;
