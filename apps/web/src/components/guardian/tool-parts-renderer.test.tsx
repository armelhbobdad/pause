import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DynamicToolUIPart, UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageRenderer } from "./message-renderer";
import { isBestOffer, ToolPartsRenderer } from "./tool-parts-renderer";

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
    disabled?: boolean;
  }) => (
    <div
      data-disabled={disabled}
      data-is-applied={isApplied}
      data-is-applying={isApplying}
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

  it("renders placeholder for present_reflection", () => {
    const part = makeToolPart({
      toolName: "present_reflection",
      output: {},
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Reflection prompt (Epic 5)")).toBeInTheDocument();
  });

  it("renders placeholder for show_wait_option", () => {
    const part = makeToolPart({
      toolName: "show_wait_option",
      output: {},
    });

    render(<ToolPartsRenderer part={part} />);
    expect(screen.getByText("Wait option (Epic 5)")).toBeInTheDocument();
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
