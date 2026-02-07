"use client";

import type { DynamicToolUIPart } from "ai";
import { useState } from "react";
import { toast } from "sonner";
import { ReflectionPrompt } from "@/components/guardian/reflection-prompt";
import { SavingsTicket } from "@/components/guardian/savings-ticket";
import { WaitCard } from "@/components/guardian/wait-card";
import type { ToolName } from "@/lib/guardian/tool-names";
import { TOOL_NAMES } from "@/lib/guardian/tool-names";
import type {
  BestOffer,
  ReflectionPromptOutput,
  WaitOptionOutput,
} from "@/lib/guardian/types";
import { assertNever } from "@/lib/utils/assert-never";

// ============================================================================
// Type Guards
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

/** Runtime validation that a value has the ReflectionPromptOutput shape. */
export function isReflectionPrompt(
  value: unknown
): value is ReflectionPromptOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.strategyId === "string" &&
    typeof obj.reflectionPrompt === "string" &&
    typeof obj.strategyName === "string"
  );
}

/** Runtime validation that a value has the WaitOptionOutput shape. */
export function isWaitOption(value: unknown): value is WaitOptionOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.durationHours === "number" && typeof obj.reasoning === "string"
  );
}

// ============================================================================
// SavingsTicketContainer — stateful wrapper (keeps ToolPartsRenderer pure)
// ============================================================================

interface SavingsTicketContainerProps {
  bestOffer: BestOffer;
  interactionId?: string | null;
  onRevealApproved?: () => void;
}

function SavingsTicketContainer({
  bestOffer,
  interactionId,
  onRevealApproved,
}: SavingsTicketContainerProps) {
  const [isApplied, setIsApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleApply = async (offer: BestOffer) => {
    if (!interactionId) {
      return;
    }
    setIsApplying(true);

    // Step 1: Clipboard copy (skip for price_match)
    let clipboardOk = false;
    if (offer.type !== "price_match") {
      try {
        await navigator.clipboard.writeText(offer.code);
        clipboardOk = true;
      } catch {
        clipboardOk = false;
      }
    }

    // Step 2: POST to apply-savings
    try {
      const response = await fetch("/api/ai/guardian/apply-savings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interactionId,
          couponCode: offer.type === "price_match" ? undefined : offer.code,
          amountCents: offer.discountCents,
          source: offer.source,
        }),
      });

      if (!response.ok) {
        throw new Error("API call failed");
      }

      // Step 3: Toast based on clipboard result
      if (offer.type === "price_match") {
        toast.success("Price match applied! Card unlocked.", {
          duration: 3000,
        });
      } else if (clipboardOk) {
        toast.success("Code copied! Card unlocked.", { duration: 3000 });
      } else {
        toast.success(`Card unlocked! Copy code manually: ${offer.code}`, {
          duration: 6000,
        });
      }

      // Step 4: Update state and reveal card
      setIsApplying(false);
      setIsApplied(true);
      onRevealApproved?.();
    } catch {
      toast.error("Failed to apply savings. Try again.", { duration: 4000 });
      setIsApplying(false);
    }
  };

  const handleSkip = async () => {
    if (!interactionId) {
      return;
    }
    setIsSkipping(true);

    try {
      const response = await fetch("/api/ai/guardian/skip-savings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interactionId }),
      });

      if (!response.ok) {
        throw new Error("API call failed");
      }

      toast.success("No problem! Your card is unlocked.", { duration: 3000 });
      setIsSkipping(false);
      setIsSkipped(true);
      onRevealApproved?.();
    } catch {
      toast.error("Something went wrong. Try again.", { duration: 4000 });
      setIsSkipping(false);
    }
  };

  return (
    <SavingsTicket
      bestOffer={bestOffer}
      disabled={!interactionId}
      isApplied={isApplied}
      isApplying={isApplying}
      isSkipped={isSkipped}
      isSkipping={isSkipping}
      onApply={handleApply}
      onSkip={handleSkip}
    />
  );
}

// ============================================================================
// Shared wait-defer POST helper (used by both containers)
// ============================================================================

async function postWaitDefer(interactionId: string): Promise<void> {
  const response = await fetch("/api/ai/guardian/wait-defer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ interactionId }),
  });
  if (!response.ok) {
    throw new Error("API call failed");
  }
  toast.success("Good call. Your card will be here when you're ready.");
}

// ============================================================================
// ReflectionPromptContainer — stateful wrapper
// ============================================================================

interface ReflectionPromptContainerProps {
  output: ReflectionPromptOutput;
  interactionId?: string | null;
  onRevealApproved?: () => void;
  onWait?: () => void;
}

function ReflectionPromptContainer({
  output,
  interactionId,
  onRevealApproved,
  onWait,
}: ReflectionPromptContainerProps) {
  const [isOverridden, setIsOverridden] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleOverride = () => {
    if (isOverridden || isWaiting) {
      return;
    }
    setIsOverridden(true);
    onRevealApproved?.();
  };

  const handleWait = async () => {
    if (isWaiting || isOverridden || !interactionId) {
      return;
    }
    setIsWaiting(true);

    try {
      await postWaitDefer(interactionId);
      onWait?.();
    } catch {
      toast.error("Something went wrong. Try again.", { duration: 4000 });
      setIsWaiting(false);
    }
  };

  return (
    <ReflectionPrompt
      disabled={!interactionId || isOverridden || isWaiting}
      onOverride={handleOverride}
      onWait={handleWait}
      output={output}
    />
  );
}

// ============================================================================
// WaitCardContainer — stateful wrapper
// ============================================================================

interface WaitCardContainerProps {
  output: WaitOptionOutput;
  interactionId?: string | null;
  onRevealApproved?: () => void;
  onWait?: () => void;
}

function WaitCardContainer({
  output,
  interactionId,
  onRevealApproved,
  onWait,
}: WaitCardContainerProps) {
  const [isOverridden, setIsOverridden] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleOverride = () => {
    if (isOverridden || isWaiting) {
      return;
    }
    setIsOverridden(true);
    onRevealApproved?.();
  };

  const handleWait = async () => {
    if (isWaiting || isOverridden || !interactionId) {
      return;
    }
    setIsWaiting(true);

    try {
      await postWaitDefer(interactionId);
      onWait?.();
    } catch {
      toast.error("Something went wrong. Try again.", { duration: 4000 });
      setIsWaiting(false);
    }
  };

  return (
    <WaitCard
      disabled={!interactionId || isOverridden || isWaiting}
      onOverride={handleOverride}
      onWait={handleWait}
      output={output}
    />
  );
}

// ============================================================================
// ToolPartsRenderer
// ============================================================================

export interface ToolPartsRendererProps {
  part: DynamicToolUIPart;
  interactionId?: string | null;
  onRevealApproved?: () => void;
  onWait?: () => void;
}

export function ToolPartsRenderer({
  part,
  interactionId,
  onRevealApproved,
  onWait,
}: ToolPartsRendererProps) {
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
      return (
        <SavingsTicketContainer
          bestOffer={part.output}
          interactionId={interactionId}
          onRevealApproved={onRevealApproved}
        />
      );
    }
    case TOOL_NAMES.PRESENT_REFLECTION: {
      if (!isReflectionPrompt(part.output)) {
        return (
          <div data-tool-fallback="present_reflection">
            Reflection data unavailable
          </div>
        );
      }
      return (
        <ReflectionPromptContainer
          interactionId={interactionId}
          onRevealApproved={onRevealApproved}
          onWait={onWait}
          output={part.output}
        />
      );
    }
    case TOOL_NAMES.SHOW_WAIT_OPTION: {
      if (!isWaitOption(part.output)) {
        return (
          <div data-tool-fallback="show_wait_option">
            Wait option unavailable
          </div>
        );
      }
      return (
        <WaitCardContainer
          interactionId={interactionId}
          onRevealApproved={onRevealApproved}
          onWait={onWait}
          output={part.output}
        />
      );
    }
    default:
      return assertNever(toolName);
  }
}
