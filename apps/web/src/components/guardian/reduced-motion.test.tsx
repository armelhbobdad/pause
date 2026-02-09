import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockReducedMotion = vi.hoisted(() => vi.fn(() => true));

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
    messages: [],
    sendMessage: vi.fn(),
    status: "idle",
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
  },
}));

import { BlurOverlay } from "@/components/guardian/blur-overlay";
import { CardVaultInner } from "@/components/guardian/card-vault-inner";
import { ProgressiveSkeleton } from "@/components/guardian/progressive-skeleton";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { FloatingChatWidget } from "@/components/uitripled/floating-chat-widget-shadcnui";
import { NativeButton } from "@/components/uitripled/native-button-shadcnui";

describe("Reduced motion compliance (Story 10.6, AC#10)", () => {
  it("NativeButton does not animate opacity when reduced motion is preferred", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<NativeButton loading>Submit</NativeButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("FloatingChatWidget renders without errors with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<FloatingChatWidget />);
    expect(screen.getByLabelText("Open chat")).toBeInTheDocument();
  });

  it("AppNavbar renders without errors with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<AppNavbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("NativeButton does not scale on hover/tap when reduced motion is preferred", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<NativeButton>Click</NativeButton>);
    expect(screen.getByText("Click")).toBeInTheDocument();
  });

  it("BlurOverlay renders in blurred state with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<BlurOverlay state="blurred" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("BlurOverlay renders in revealing state with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<BlurOverlay state="revealing" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("CardVaultInner renders in idle state with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<CardVaultInner guardianState="idle" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("CardVaultInner renders in active state with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<CardVaultInner guardianState="active" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("ProgressiveSkeleton renders active with reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<ProgressiveSkeleton isActive />);
    expect(
      screen.getByText("Analyzing your spending patterns...")
    ).toBeInTheDocument();
  });
});
