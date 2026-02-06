/**
 * Guardian tool name constants and shared type.
 *
 * This file is intentionally NOT under lib/server/ — the ToolName type
 * must be importable by both server code (tool definitions) and client
 * code (tool renderer in Story 4.4). Contains zero runtime logic beyond
 * a const object.
 *
 * @see ADR-009: UIMessage Parts — Exhaustive Switch with Shared Type Contract
 */

export type ToolName =
  | "search_coupons"
  | "present_reflection"
  | "show_wait_option";

export const TOOL_NAMES = {
  SEARCH_COUPONS: "search_coupons",
  PRESENT_REFLECTION: "present_reflection",
  SHOW_WAIT_OPTION: "show_wait_option",
} as const satisfies Record<string, ToolName>;
