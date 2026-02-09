import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => ({
  useQueryCallIndex: 0,
  dashboardResult: {
    data: undefined as
      | {
          interactionCount: number;
          totalSavedCents: number;
          acceptanceRate: number;
          recentInteractions: Array<{
            id: string;
            tier: string;
            outcome: string | null;
            reasoningSummary: string | null;
            createdAt: Date;
            cardLastFour: string | null;
          }>;
        }
      | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  cardResult: {
    data: undefined as
      | {
          id: string;
          userId: string;
          lastFour: string;
          nickname: string | null;
          status: string;
          lockedAt: Date | null;
          unlockedAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  savingsResult: {
    data: undefined as
      | {
          totalCents: number;
          dealCount: number;
          avgCents: number;
          sourceBreakdown: Array<{
            source: string;
            totalCents: number;
            count: number;
          }>;
        }
      | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  referralResult: {
    data: undefined as
      | { shouldShow: boolean; consecutiveOverrides: number }
      | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
}));

// --- Mock @tanstack/react-query useQuery ---
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => {
      const idx = mocks.useQueryCallIndex++;
      // Order: dashboard.summary, dashboard.getCard, savings.getSummary, dashboard.referralStatus
      if (idx === 0) {
        return mocks.dashboardResult;
      }
      if (idx === 1) {
        return mocks.cardResult;
      }
      if (idx === 2) {
        return mocks.savingsResult;
      }
      return mocks.referralResult;
    }),
  };
});

// --- Mock tRPC ---
vi.mock("@/utils/trpc", () => ({
  trpc: {
    dashboard: {
      summary: {
        queryOptions: vi.fn(() => ({
          queryKey: ["dashboard", "summary"],
          queryFn: vi.fn(),
        })),
      },
      getCard: {
        queryOptions: vi.fn(() => ({
          queryKey: ["dashboard", "getCard"],
          queryFn: vi.fn(),
        })),
      },
      referralStatus: {
        queryOptions: vi.fn(() => ({
          queryKey: ["dashboard", "referralStatus"],
          queryFn: vi.fn(),
        })),
      },
    },
    savings: {
      getSummary: {
        queryOptions: vi.fn(() => ({
          queryKey: ["savings", "getSummary"],
          queryFn: vi.fn(),
        })),
      },
    },
  },
}));

// --- Mock formatRelativeTime ---
vi.mock("@/lib/format", () => ({
  formatRelativeTime: vi.fn(() => "1 hour ago"),
}));

// --- Mock CommandCenter (tested separately in its own 21-test suite) ---
vi.mock("@/components/guardian/command-center", () => ({
  CommandCenter: ({
    feedContent,
  }: {
    feedContent?: React.ReactNode;
    card: unknown;
    cardId?: string;
  }) => <div data-testid="command-center">{feedContent}</div>,
}));

// Import after mocks are set up (vi.mock is hoisted)
import Dashboard from "./dashboard";

const DEFAULT_CARD = {
  id: "card-1",
  userId: "user-1",
  lastFour: "4242",
  nickname: null,
  status: "active",
  lockedAt: null,
  unlockedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQueryCallIndex = 0;
    mocks.dashboardResult = {
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.cardResult = {
      data: DEFAULT_CARD,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.savingsResult = {
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.referralResult = {
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("skeleton loading state renders", () => {
    mocks.dashboardResult.isLoading = true;

    renderDashboard();

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("skeleton renders when card is loading", () => {
    mocks.cardResult.isLoading = true;

    renderDashboard();

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("error state renders with retry button and logs error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* suppress test output — AC#8 requires console.error logging */
    });
    const user = userEvent.setup();
    mocks.dashboardResult.error = new Error("Network error");

    renderDashboard();

    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to load dashboard. Pull to refresh.")
    ).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Dashboard query failed:",
      mocks.dashboardResult.error
    );

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(mocks.dashboardResult.refetch).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it("data renders sections", () => {
    mocks.dashboardResult.data = {
      interactionCount: 5,
      totalSavedCents: 2500,
      acceptanceRate: 80,
      recentInteractions: [
        {
          id: "int-1",
          tier: "analyst",
          outcome: "accepted",
          reasoningSummary: "Quick approval",
          createdAt: new Date("2026-02-08"),
          cardLastFour: "1234",
        },
      ],
    };

    renderDashboard();

    // SavingsSummary renders
    expect(screen.getByTestId("total-saved")).toHaveTextContent("$25.00");
    expect(screen.getByTestId("interaction-count")).toHaveTextContent(
      "5 Guardian interactions"
    );

    // RecentInteractions renders
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("••1234")).toBeInTheDocument();
  });

  it("revalidation updates UI without spinner", () => {
    mocks.dashboardResult.data = {
      interactionCount: 3,
      totalSavedCents: 1500,
      acceptanceRate: 66.7,
      recentInteractions: [],
    };
    mocks.dashboardResult.isLoading = false;

    renderDashboard();

    // Data visible, no skeleton
    expect(screen.getByTestId("total-saved")).toHaveTextContent("$15.00");
    expect(screen.queryByTestId("dashboard-skeleton")).not.toBeInTheDocument();
  });

  it("renders savings counter and breakdown when savings data is loaded", () => {
    mocks.dashboardResult.data = {
      interactionCount: 3,
      totalSavedCents: 6200,
      acceptanceRate: 100,
      recentInteractions: [],
    };
    mocks.savingsResult.data = {
      totalCents: 6200,
      dealCount: 2,
      avgCents: 3100,
      sourceBreakdown: [
        { source: "TechDeals", totalCents: 4200, count: 1 },
        { source: "RetailCo", totalCents: 2000, count: 1 },
      ],
    };

    renderDashboard();

    expect(screen.getByTestId("savings-counter")).toBeInTheDocument();
    expect(screen.getByTestId("savings-breakdown")).toBeInTheDocument();
  });

  it("hides savings counter when savings data is loading", () => {
    mocks.dashboardResult.data = {
      interactionCount: 3,
      totalSavedCents: 6200,
      acceptanceRate: 100,
      recentInteractions: [],
    };
    mocks.savingsResult.isLoading = true;

    renderDashboard();

    expect(screen.queryByTestId("savings-counter")).not.toBeInTheDocument();
  });

  it("renders feed content inside CommandCenter", () => {
    mocks.dashboardResult.data = {
      interactionCount: 0,
      totalSavedCents: 0,
      acceptanceRate: 0,
      recentInteractions: [],
    };

    renderDashboard();

    expect(screen.getByTestId("command-center")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-feed")).toBeInTheDocument();
  });

  it("renders empty interactions with HistoryEmptyState component", () => {
    mocks.dashboardResult.data = {
      interactionCount: 0,
      totalSavedCents: 0,
      acceptanceRate: 0,
      recentInteractions: [],
    };

    renderDashboard();

    expect(
      screen.getByText("No unlock requests yet. Tap your card to try it out!")
    ).toBeInTheDocument();
  });
});
