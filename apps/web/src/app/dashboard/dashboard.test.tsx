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
}));

// --- Mock @tanstack/react-query useQuery ---
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => {
      const idx = mocks.useQueryCallIndex++;
      // First useQuery call is dashboard.summary, second is savings.getSummary
      return idx === 0 ? mocks.dashboardResult : mocks.savingsResult;
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

// Import after mocks are set up (vi.mock is hoisted)
import Dashboard from "./dashboard";

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
    mocks.savingsResult = {
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

  it("shows onboarding prompt for new user with no interactions", () => {
    mocks.dashboardResult.data = {
      interactionCount: 0,
      totalSavedCents: 0,
      acceptanceRate: 0,
      recentInteractions: [],
    };

    renderDashboard();

    const prompt = screen.getByTestId("onboarding-prompt");
    expect(prompt).toBeInTheDocument();
    expect(prompt).toHaveTextContent("Tap to meet your Guardian");
  });

  it("hides onboarding prompt when user has interactions", () => {
    mocks.dashboardResult.data = {
      interactionCount: 3,
      totalSavedCents: 1500,
      acceptanceRate: 66.7,
      recentInteractions: [
        {
          id: "int-1",
          tier: "analyst",
          outcome: "accepted",
          reasoningSummary: null,
          createdAt: new Date("2026-02-08"),
          cardLastFour: "1234",
        },
      ],
    };

    renderDashboard();

    expect(screen.queryByTestId("onboarding-prompt")).not.toBeInTheDocument();
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
