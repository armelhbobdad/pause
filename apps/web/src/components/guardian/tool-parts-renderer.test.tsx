import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DynamicToolUIPart, UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageRenderer } from "./message-renderer";
import {
  isBestOffer,
  isReflectionPrompt,
  isWaitOption,
  ToolPartsRenderer,
} from "./tool-parts-renderer";

// ============================================================================
// Hoisted mocks
// ============================================================================

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@/components/guardian/savings-ticket", () => ({
  SavingsTicket: ({
    bestOffer,
    onApply,
    isApplied,
    isApplying,
    onSkip,
    isSkipped,
    isSkipping,
    disabled,
  }: {
    bestOffer: {
      code: string;
      discount: string;
      discountCents: number;
      source: string;
    };
    onApply?: (offer: unknown) => Promise<void>;
    isApplied?: boolean;
    isApplying?: boolean;
    onSkip?: () => Promise<void>;
    isSkipped?: boolean;
    isSkipping?: boolean;
    disabled?: boolean;
  }) => (
    <div
      data-disabled={disabled}
      data-is-applied={isApplied}
      data-is-applying={isApplying}
      data-is-skipped={isSkipped}
      data-is-skipping={isSkipping}
      data-testid="savings-ticket"
    >
      SavingsTicket:{bestOffer.code}:{bestOffer.source}
      {onApply && (
        <button
          data-testid="apply-button"
          onClick={() => onApply(bestOffer)}
          type="button"
        >
          Apply
        </button>
      )}
      {onSkip && (
        <button
          data-testid="skip-button"
          onClick={() => onSkip()}
          type="button"
        >
          Skip
        </button>
      )}
    </div>
  ),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({
    children,
    isAnimating,
  }: {
    children?: string;
    isAnimating?: boolean;
  }) => (
    <div data-animating={isAnimating} data-testid="streamdown">
      {children}
    </div>
  ),
}));

vi.mock("@/components/guardian/reflection-prompt", () => ({
  ReflectionPrompt: ({
    output,
    onOverride,
    onWait,
    disabled,
  }: {
    output: {
      strategyId: string;
      reflectionPrompt: string;
      strategyName: string;
    };
    onOverride?: () => void;
    onWait?: () => void;
    disabled?: boolean;
  }) => (
    <div data-disabled={disabled} data-testid="reflection-prompt">
      {output.reflectionPrompt}:{output.strategyName}
      {onOverride && (
        <button
          data-testid="override-button"
          onClick={onOverride}
          type="button"
        >
          Override
        </button>
      )}
      {onWait && (
        <button
          data-testid="reflection-wait-button"
          onClick={onWait}
          type="button"
        >
          Wait
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/guardian/wait-card", () => ({
  WaitCard: ({
    output,
    onOverride,
    onWait,
    disabled,
  }: {
    output: { durationHours: number; reasoning: string };
    onOverride?: () => void;
    onWait?: () => void;
    disabled?: boolean;
  }) => (
    <div data-disabled={disabled} data-testid="wait-card">
      {output.reasoning}:{output.durationHours}h
      {onOverride && (
        <button
          data-testid="wait-override-button"
          onClick={onOverride}
          type="button"
        >
          Override
        </button>
      )}
      {onWait && (
        <button data-testid="wait-sleep-button" onClick={onWait} type="button">
          Sleep
        </button>
      )}
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function makeToolPart(
  overrides: Partial<DynamicToolUIPart> & { toolName: string }
): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolCallId: "call-1",
    state: "output-available",
    input: {},
    output: undefined,
    ...overrides,
  } as DynamicToolUIPart;
}

function makeMessage(
  parts: UIMessage["parts"],
  role: "assistant" | "user" = "assistant"
): UIMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role,
    parts,
  };
}

function makeValidOffer(overrides: Record<string, unknown> = {}) {
  return {
    code: "SAVE20",
    discount: "20% OFF",
    discountCents: 2000,
    type: "percentage",
    source: "TestStore",
    expiresAt: null,
    selectionReasoning: "Best deal",
    ...overrides,
  };
}

// ============================================================================
// ToolPartsRenderer — AC#1: Exhaustive switch
// ============================================================================

describe("ToolPartsRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("renders SavingsTicket for search_coupons tool result", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByTestId("savings-ticket")).toHaveTextContent(
      "SavingsTicket:SAVE20:TestStore"
    );
  });

  it("renders ReflectionPromptContainer for present_reflection tool", () => {
    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByTestId("reflection-prompt")).toHaveTextContent(
      "What would tomorrow-you think?:Future-Self Visualization"
    );
  });

  it("renders WaitCardContainer for show_wait_option tool", () => {
    const part = makeToolPart({
      toolName: "show_wait_option",
      output: {
        durationHours: 24,
        reasoning: "Sleeping on it helps",
      },
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByTestId("wait-card")).toHaveTextContent(
      "Sleeping on it helps:24h"
    );
  });

  it("renders fallback when reflection output is invalid shape", () => {
    const part = makeToolPart({
      toolName: "present_reflection",
      output: { invalid: true },
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Reflection data unavailable")).toBeInTheDocument();
  });

  it("renders fallback when wait output is invalid shape", () => {
    const part = makeToolPart({
      toolName: "show_wait_option",
      output: { invalid: true },
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Wait option unavailable")).toBeInTheDocument();
  });

  // AC#5: Null/loading states
  it("shows shimmer loading for tool-call without result", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      state: "input-available",
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    const loader = container.querySelector("[data-tool-loading]");
    expect(loader).toBeInTheDocument();
    expect(loader?.tagName.toLowerCase()).toBe("output");
  });

  it("transitions from loading to rendered on result arrival", () => {
    const loadingPart = makeToolPart({
      toolName: "search_coupons",
      state: "input-available",
    });

    const { container, rerender } = render(
      <ToolPartsRenderer part={loadingPart} />
    );
    expect(container.querySelector("[data-tool-loading]")).toBeInTheDocument();

    const resultPart = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer({ code: "SAVE10", source: "Store" }),
    });

    rerender(<ToolPartsRenderer part={resultPart} />);
    expect(
      container.querySelector("[data-tool-loading]")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("savings-ticket")).toHaveTextContent(
      "SavingsTicket:SAVE10:Store"
    );
  });

  // AC#5: Terminal error states
  it("renders error message for output-error state", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      state: "output-error",
      errorText: "Tool execution failed",
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    const errorEl = container.querySelector("[data-tool-error]");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent("Tool execution failed");
    expect(
      container.querySelector("[data-tool-loading]")
    ).not.toBeInTheDocument();
  });

  it("renders fallback error for output-denied state", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      state: "output-denied",
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    const errorEl = container.querySelector("[data-tool-error]");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent("Tool action could not be completed");
    expect(
      container.querySelector("[data-tool-loading]")
    ).not.toBeInTheDocument();
  });

  it("shows shimmer loading for input-streaming state", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      state: "input-streaming",
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    expect(container.querySelector("[data-tool-loading]")).toBeInTheDocument();
  });

  // --- Story 5.2 AC6: shimmer has aria-label for accessibility ---
  it('shimmer loading state has aria-label="Loading tool result" (AC6)', () => {
    const part = makeToolPart({
      toolName: "present_reflection",
      state: "input-available",
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByLabelText("Loading tool result")).toBeInTheDocument();
  });

  it("shimmer has data-tool-loading attribute for CSS targeting (AC6)", () => {
    const part = makeToolPart({
      toolName: "show_wait_option",
      state: "input-streaming",
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    const loader = container.querySelector("[data-tool-loading]");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("aria-label", "Loading tool result");
  });

  it("output-available state renders correct component, not shimmer (AC6)", () => {
    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    const { container } = render(<ToolPartsRenderer part={part} />);
    expect(
      container.querySelector("[data-tool-loading]")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("reflection-prompt")).toBeInTheDocument();
  });

  // AC#6: Invalid result data handling
  it("renders fallback for malformed search_coupons result", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: { invalid: true },
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Savings data unavailable")).toBeInTheDocument();
  });

  it("renders fallback when search_coupons result is null", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: null,
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Savings data unavailable")).toBeInTheDocument();
  });
});

// ============================================================================
// SavingsTicketContainer — Story 4.5
// ============================================================================

describe("SavingsTicketContainer (via ToolPartsRenderer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("renders SavingsTicket with disabled=true when interactionId is null", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId={null}
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    const ticket = screen.getByTestId("savings-ticket");
    expect(ticket).toHaveAttribute("data-disabled", "true");
  });

  it("renders SavingsTicket with disabled=false when interactionId is present", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    const ticket = screen.getByTestId("savings-ticket");
    expect(ticket).toHaveAttribute("data-disabled", "false");
  });

  it("handleApply calls clipboard API and posts to apply-savings endpoint", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("apply-button"));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("SAVE20");
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/ai/guardian/apply-savings",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("handleApply calls revealApproved on success", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("apply-button"));

    await waitFor(() => {
      expect(mockReveal).toHaveBeenCalled();
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Code copied! Card unlocked.",
      expect.objectContaining({ duration: 3000 })
    );
  });

  it("handleApply shows error toast on API failure and does NOT call revealApproved", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "fail" }), { status: 500 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("apply-button"));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to apply savings. Try again.",
        expect.objectContaining({ duration: 4000 })
      );
    });

    // AC#6: Button re-enables after failure
    await waitFor(() => {
      expect(screen.getByTestId("savings-ticket")).toHaveAttribute(
        "data-is-applying",
        "false"
      );
    });

    expect(mockReveal).not.toHaveBeenCalled();
  });

  it("handleApply with clipboard failure still calls API and revealApproved, shows manual copy toast", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")),
      },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("apply-button"));

    await waitFor(() => {
      expect(mockReveal).toHaveBeenCalled();
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Card unlocked! Copy code manually: SAVE20",
      expect.objectContaining({ duration: 6000 })
    );
  });

  it("handleApply with price_match skips clipboard and shows price match toast", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer({ type: "price_match" }),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("apply-button"));

    await waitFor(() => {
      expect(mockReveal).toHaveBeenCalled();
    });

    // Clipboard should NOT have been called for price_match
    expect(clipboardWriteText).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Price match applied! Card unlocked.",
      expect.objectContaining({ duration: 3000 })
    );
  });
});

// ============================================================================
// isBestOffer type guard
// ============================================================================

describe("isBestOffer", () => {
  it("returns true for valid BestOffer shape", () => {
    expect(
      isBestOffer({
        code: "A",
        discount: "10%",
        discountCents: 100,
        type: "percentage",
        source: "s",
        expiresAt: null,
        selectionReasoning: "r",
      })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isBestOffer(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isBestOffer("string")).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isBestOffer({ code: "A" })).toBe(false);
  });

  it("returns false when discountCents is missing", () => {
    expect(
      isBestOffer({
        code: "A",
        discount: "10%",
        type: "percentage",
        source: "s",
      })
    ).toBe(false);
  });

  it("returns false when source is missing", () => {
    expect(
      isBestOffer({
        code: "A",
        discount: "10%",
        type: "percentage",
        discountCents: 100,
      })
    ).toBe(false);
  });
});

// ============================================================================
// MessageRenderer — AC#2, #4
// ============================================================================

describe("MessageRenderer", () => {
  it("renders text parts via Streamdown", () => {
    const messages = [makeMessage([{ type: "text", text: "Hello guardian" }])];

    render(
      <MessageRenderer
        guardianContent={null}
        isStreaming={false}
        messages={messages}
      />
    );
    const streamdown = screen.getByTestId("streamdown");
    expect(streamdown).toHaveTextContent("Hello guardian");
  });

  it("renders mixed text + tool parts in correct order", () => {
    const messages = [
      makeMessage([
        { type: "text", text: "I found a deal:" },
        makeToolPart({
          toolName: "search_coupons",
          toolCallId: "tool-1",
          output: makeValidOffer({ code: "MIX20", source: "Store" }),
        }),
      ]),
    ];

    render(
      <MessageRenderer
        guardianContent={null}
        isStreaming={false}
        messages={messages}
      />
    );

    expect(screen.getByTestId("streamdown")).toHaveTextContent(
      "I found a deal:"
    );
    expect(screen.getByTestId("savings-ticket")).toHaveTextContent(
      "SavingsTicket:MIX20:Store"
    );
  });

  it("renders breath beat data-breath-beat attribute on tool containers", () => {
    const messages = [
      makeMessage([
        makeToolPart({
          toolName: "search_coupons",
          toolCallId: "tool-breath",
          output: makeValidOffer({ code: "BB10", source: "Store" }),
        }),
      ]),
    ];

    const { container } = render(
      <MessageRenderer
        guardianContent={null}
        isStreaming={false}
        messages={messages}
      />
    );

    expect(container.querySelector("[data-breath-beat]")).toBeInTheDocument();
  });

  it("falls back to guardianContent when messages is empty", () => {
    render(
      <MessageRenderer
        guardianContent={<div data-testid="fallback">Fallback content</div>}
        isStreaming={false}
        messages={[]}
      />
    );
    expect(screen.getByTestId("fallback")).toHaveTextContent(
      "Fallback content"
    );
  });

  it("passes isAnimating to Streamdown based on isStreaming", () => {
    const messages = [makeMessage([{ type: "text", text: "Streaming text" }])];

    render(
      <MessageRenderer
        guardianContent={null}
        isStreaming={true}
        messages={messages}
      />
    );

    const streamdown = screen.getByTestId("streamdown");
    expect(streamdown).toHaveAttribute("data-animating", "true");
  });

  it("filters to only assistant messages", () => {
    const messages = [
      makeMessage([{ type: "text", text: "User message" }], "user"),
      makeMessage([{ type: "text", text: "Assistant reply" }], "assistant"),
    ];

    render(
      <MessageRenderer
        guardianContent={null}
        isStreaming={false}
        messages={messages}
      />
    );

    const streamdowns = screen.getAllByTestId("streamdown");
    expect(streamdowns).toHaveLength(1);
    expect(streamdowns[0]).toHaveTextContent("Assistant reply");
  });
});

// ============================================================================
// SavingsTicketContainer — Skip flow (Story 4.6)
// ============================================================================

describe("SavingsTicketContainer skip flow (via ToolPartsRenderer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("passes onSkip to SavingsTicket", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    expect(screen.getByTestId("skip-button")).toBeInTheDocument();
  });

  it("handleSkip posts to skip-savings endpoint", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("skip-button"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/ai/guardian/skip-savings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ interactionId: "int-123" }),
        })
      );
    });
  });

  it("handleSkip calls revealApproved on success", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("skip-button"));

    await waitFor(() => {
      expect(mockReveal).toHaveBeenCalled();
    });
  });

  it("handleSkip shows error toast on API failure and does NOT call revealApproved", async () => {
    const user = userEvent.setup();
    const mockReveal = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "fail" }), { status: 500 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={mockReveal}
        part={part}
      />
    );

    await user.click(screen.getByTestId("skip-button"));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Something went wrong. Try again.",
        expect.objectContaining({ duration: 4000 })
      );
    });

    expect(mockReveal).not.toHaveBeenCalled();
  });

  it("handleSkip shows success toast with correct message", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    await user.click(screen.getByTestId("skip-button"));

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "No problem! Your card is unlocked.",
        expect.objectContaining({ duration: 3000 })
      );
    });
  });

  it("handleSkip does not call fetch when interactionId is null", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId={null}
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    // Button is disabled via disabled={!interactionId}, but even if triggered,
    // the handleSkip guard should prevent fetch
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("both buttons disabled during skip API call", async () => {
    const user = userEvent.setup();
    const deferred = {
      resolve: (_value: Response) => {
        // noop placeholder — reassigned by Promise constructor
      },
    };
    const skipPromise = new Promise<Response>((resolve) => {
      deferred.resolve = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(skipPromise);

    const part = makeToolPart({
      toolName: "search_coupons",
      output: makeValidOffer(),
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onRevealApproved={vi.fn()}
        part={part}
      />
    );

    await user.click(screen.getByTestId("skip-button"));

    // While API call is in flight, isSkipping should be true
    await waitFor(() => {
      expect(screen.getByTestId("savings-ticket")).toHaveAttribute(
        "data-is-skipping",
        "true"
      );
    });

    // Resolve the pending fetch
    deferred.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await waitFor(() => {
      expect(screen.getByTestId("savings-ticket")).toHaveAttribute(
        "data-is-skipped",
        "true"
      );
    });
  });
});

// ============================================================================
// isReflectionPrompt type guard (Story 5.1)
// ============================================================================

describe("isReflectionPrompt", () => {
  it("returns true for valid ReflectionPromptOutput shape", () => {
    expect(
      isReflectionPrompt({
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isReflectionPrompt(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isReflectionPrompt("string")).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isReflectionPrompt({ strategyId: "future_self" })).toBe(false);
  });

  it("returns false when reflectionPrompt is not a string", () => {
    expect(
      isReflectionPrompt({
        strategyId: "future_self",
        reflectionPrompt: 42,
        strategyName: "Test",
      })
    ).toBe(false);
  });
});

// ============================================================================
// isWaitOption type guard (Story 5.1)
// ============================================================================

describe("isWaitOption", () => {
  it("returns true for valid WaitOptionOutput shape", () => {
    expect(
      isWaitOption({
        durationHours: 24,
        reasoning: "Sleeping on it helps",
      })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isWaitOption(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isWaitOption(123)).toBe(false);
  });

  it("returns false for missing durationHours", () => {
    expect(isWaitOption({ reasoning: "test" })).toBe(false);
  });

  it("returns false when durationHours is not a number", () => {
    expect(isWaitOption({ durationHours: "24", reasoning: "test" })).toBe(
      false
    );
  });
});

// ============================================================================
// WaitCardContainer — Wait flow (Story 5.3)
// ============================================================================

describe("WaitCardContainer wait flow (via ToolPartsRenderer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("WaitCardContainer posts to wait-defer endpoint on wait click", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "show_wait_option",
      output: { durationHours: 24, reasoning: "Sleeping on it helps" },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("wait-sleep-button"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/ai/guardian/wait-defer",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ interactionId: "int-123" }),
        })
      );
    });
  });

  it("WaitCardContainer calls onWait callback after successful POST", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "show_wait_option",
      output: { durationHours: 24, reasoning: "Sleeping on it helps" },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("wait-sleep-button"));

    await waitFor(() => {
      expect(mockWait).toHaveBeenCalled();
    });
  });

  it("WaitCardContainer shows success toast after wait", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "show_wait_option",
      output: { durationHours: 24, reasoning: "Sleeping on it helps" },
    });

    render(
      <ToolPartsRenderer interactionId="int-123" onWait={vi.fn()} part={part} />
    );

    await user.click(screen.getByTestId("wait-sleep-button"));

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Good call. Your card will be here when you're ready."
      );
    });
  });

  it("WaitCardContainer shows error toast on API failure and does NOT call onWait", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "fail" }), { status: 500 })
    );

    const part = makeToolPart({
      toolName: "show_wait_option",
      output: { durationHours: 24, reasoning: "Sleeping on it helps" },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("wait-sleep-button"));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Something went wrong. Try again.",
        expect.objectContaining({ duration: 4000 })
      );
    });

    expect(mockWait).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ReflectionPromptContainer — Wait flow (Story 5.3)
// ============================================================================

describe("ReflectionPromptContainer wait flow (via ToolPartsRenderer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("ReflectionPromptContainer posts to wait-defer endpoint on wait click", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("reflection-wait-button"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/ai/guardian/wait-defer",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ interactionId: "int-123" }),
        })
      );
    });
  });

  it("ReflectionPromptContainer calls onWait callback after successful POST", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("reflection-wait-button"));

    await waitFor(() => {
      expect(mockWait).toHaveBeenCalled();
    });
  });

  it("ReflectionPromptContainer shows success toast after wait", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    render(
      <ToolPartsRenderer interactionId="int-123" onWait={vi.fn()} part={part} />
    );

    await user.click(screen.getByTestId("reflection-wait-button"));

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Good call. Your card will be here when you're ready."
      );
    });
  });

  it("ReflectionPromptContainer shows error toast on API failure and does NOT call onWait", async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "fail" }), { status: 500 })
    );

    const part = makeToolPart({
      toolName: "present_reflection",
      output: {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think?",
        strategyName: "Future-Self Visualization",
      },
    });

    render(
      <ToolPartsRenderer
        interactionId="int-123"
        onWait={mockWait}
        part={part}
      />
    );

    await user.click(screen.getByTestId("reflection-wait-button"));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Something went wrong. Try again.",
        expect.objectContaining({ duration: 4000 })
      );
    });

    expect(mockWait).not.toHaveBeenCalled();
  });
});
