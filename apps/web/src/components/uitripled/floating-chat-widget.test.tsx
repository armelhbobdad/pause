import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReducedMotion = vi.hoisted(() => vi.fn(() => false));
const mockSendMessage = vi.hoisted(() => vi.fn());
const mockMessages = vi.hoisted(() => ({ current: [] as unknown[] }));
const mockStatus = vi.hoisted(() => ({ current: "idle" as string }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: mockReducedMotion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      ...actual.motion,
      div: "div" as unknown as typeof actual.motion.div,
      span: "span" as unknown as typeof actual.motion.span,
      button: "button" as unknown as typeof actual.motion.button,
    },
  };
});

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: mockMessages.current,
    sendMessage: mockSendMessage,
    status: mockStatus.current,
  }),
}));

vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn(),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({
    children,
  }: {
    children: React.ReactNode;
    isAnimating?: boolean;
  }) => <span>{children}</span>,
}));

import { FloatingChatWidget } from "./floating-chat-widget-shadcnui";

const SPENDING_PATTERNS_TEXT = /Ask me about spending patterns/;

describe("FloatingChatWidget", () => {
  beforeEach(() => {
    mockMessages.current = [];
    mockStatus.current = "idle";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chat bubble trigger", () => {
    render(<FloatingChatWidget />);
    expect(screen.getByLabelText("Open chat")).toBeInTheDocument();
  });

  it("does not render when isAvailable is false", () => {
    render(<FloatingChatWidget isAvailable={false} />);
    expect(screen.queryByLabelText("Open chat")).not.toBeInTheDocument();
  });

  it("opens the panel when bubble is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays placeholder text in empty state", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(screen.getByText(SPENDING_PATTERNS_TEXT)).toBeInTheDocument();
  });

  it("has input with correct placeholder", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(
      screen.getByPlaceholderText("Ask Pause anything...")
    ).toBeInTheDocument();
  });

  it("disables send button when input is empty", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    const input = screen.getByPlaceholderText("Ask Pause anything...");
    await user.type(input, "Hello");
    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).not.toBeDisabled();
  });

  it("calls sendMessage when form is submitted", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    const input = screen.getByPlaceholderText("Ask Pause anything...");
    await user.type(input, "Hello");
    await user.keyboard("{Enter}");
    expect(mockSendMessage).toHaveBeenCalledWith({ text: "Hello" });
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    const input = screen.getByPlaceholderText(
      "Ask Pause anything..."
    ) as HTMLInputElement;
    await user.type(input, "Hello");
    await user.keyboard("{Enter}");
    expect(input.value).toBe("");
  });

  it("closes panel when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // When open, both the header close button and bubble trigger have "Close chat"
    // The header close button is inside the dialog
    const dialog = screen.getByRole("dialog");
    const closeButton = dialog.querySelector(
      'button[aria-label="Close chat"]'
    ) as HTMLElement;
    await user.click(closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes panel on Escape key", async () => {
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders messages when present", async () => {
    mockMessages.current = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hello Pause" }],
      },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Hi! How can I help you with spending awareness?",
          },
        ],
      },
    ];

    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    expect(screen.getByText("Hello Pause")).toBeInTheDocument();
    expect(
      screen.getByText("Hi! How can I help you with spending awareness?")
    ).toBeInTheDocument();
  });

  it("shows loading state during streaming", async () => {
    mockStatus.current = "streaming";
    const user = userEvent.setup();
    render(<FloatingChatWidget />);
    await user.click(screen.getByLabelText("Open chat"));
    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).toBeDisabled();
  });
});
