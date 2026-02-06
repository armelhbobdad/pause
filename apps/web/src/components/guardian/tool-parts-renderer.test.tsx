import { render, screen } from "@testing-library/react";
import type { DynamicToolUIPart, UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { MessageRenderer } from "./message-renderer";
import { isBestOffer, ToolPartsRenderer } from "./tool-parts-renderer";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@/components/guardian/savings-ticket", () => ({
  SavingsTicket: ({
    bestOffer,
  }: {
    bestOffer: {
      code: string;
      discount: string;
      discountCents: number;
      source: string;
    };
  }) => (
    <div data-testid="savings-ticket">
      SavingsTicket:{bestOffer.code}:{bestOffer.source}
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

// ============================================================================
// ToolPartsRenderer — AC#1: Exhaustive switch
// ============================================================================

describe("ToolPartsRenderer", () => {
  it("renders SavingsTicket for search_coupons tool result", () => {
    const part = makeToolPart({
      toolName: "search_coupons",
      output: {
        code: "SAVE20",
        discount: "20% OFF",
        discountCents: 2000,
        type: "percentage",
        source: "TestStore",
        expiresAt: null,
        selectionReasoning: "Best deal",
      },
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
      output: {
        code: "SAVE10",
        discount: "10% OFF",
        discountCents: 1000,
        type: "percentage",
        source: "Store",
        expiresAt: null,
        selectionReasoning: "Good deal",
      },
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
          output: {
            code: "MIX20",
            discount: "20%",
            discountCents: 2000,
            type: "percentage",
            source: "Store",
            expiresAt: null,
            selectionReasoning: "Deal",
          },
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
          output: {
            code: "BB10",
            discount: "10%",
            discountCents: 1000,
            type: "percentage",
            source: "Store",
            expiresAt: null,
            selectionReasoning: "Deal",
          },
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
