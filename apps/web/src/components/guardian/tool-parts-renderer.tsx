import type { DynamicToolUIPart } from "ai";
import { SavingsTicket } from "@/components/guardian/savings-ticket";
import type { ToolName } from "@/lib/guardian/tool-names";
import { TOOL_NAMES } from "@/lib/guardian/tool-names";
import type { BestOffer } from "@/lib/guardian/types";
import { assertNever } from "@/lib/utils/assert-never";

// ============================================================================
// Type Guard
// ============================================================================

/** Runtime validation that a value has the BestOffer shape. */
export function isBestOffer(value: unknown): value is BestOffer {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === "string" &&
    typeof obj.discount === "string" &&
    typeof obj.type === "string" &&
    typeof obj.discountCents === "number" &&
    typeof obj.source === "string"
  );
}

// ============================================================================
// ToolPartsRenderer
// ============================================================================

export interface ToolPartsRendererProps {
  part: DynamicToolUIPart;
}

export function ToolPartsRenderer({ part }: ToolPartsRendererProps) {
  const toolName = part.toolName as ToolName;

  // Terminal error states: tool failed or was denied
  if (part.state === "output-error" || part.state === "output-denied") {
    return (
      <div data-tool-error={part.state}>
        {"errorText" in part && part.errorText
          ? part.errorText
          : "Tool action could not be completed"}
      </div>
    );
  }

  // Loading state: tool call in progress (input-streaming, input-available, approval-*)
  if (part.state !== "output-available") {
    return (
      <output
        aria-label="Loading tool result"
        data-tool-loading
        style={{
          display: "block",
          minHeight: "3rem",
          borderRadius: "0.5rem",
          background:
            "linear-gradient(90deg, oklch(0.92 0.01 250) 25%, oklch(0.96 0.005 250) 50%, oklch(0.92 0.01 250) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s ease-in-out infinite",
        }}
      />
    );
  }

  // Output available — render based on tool name
  switch (toolName) {
    case TOOL_NAMES.SEARCH_COUPONS: {
      if (!isBestOffer(part.output)) {
        return (
          <div data-tool-fallback="search_coupons">
            Savings data unavailable
          </div>
        );
      }
      return <SavingsTicket bestOffer={part.output} />;
    }
    case TOOL_NAMES.PRESENT_REFLECTION:
      return (
        <div data-tool-placeholder="present_reflection">
          Reflection prompt (Epic 5)
        </div>
      );
    case TOOL_NAMES.SHOW_WAIT_OPTION:
      return (
        <div data-tool-placeholder="show_wait_option">Wait option (Epic 5)</div>
      );
    default:
      return assertNever(toolName);
  }
}
