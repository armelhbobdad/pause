import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestDefrost, mockReportFrosted } = vi.hoisted(() => ({
  mockRequestDefrost: vi.fn(() => true),
  mockReportFrosted: vi.fn(),
}));

vi.mock("./ghost-card-manager", () => ({
  GhostCardManagerProvider: ({ children }: { children: ReactNode }) => children,
  useGhostCardManager: () => ({
    requestDefrost: mockRequestDefrost,
    reportFrosted: mockReportFrosted,
  }),
}));

vi.mock("./ghost-card", () => ({
  GhostCard: (props: Record<string, unknown>) => (
    <article
      aria-label={`Past spending: ${props.recall}`}
      data-state={props.state}
      data-submitting={props.isSubmitting ? "true" : "false"}
      data-testid={`ghost-card-${props.id}`}
      data-tier={props.tierOrigin}
    >
      <span data-testid="recall">{props.recall as string}</span>
      <span data-testid="data">{props.data as string}</span>
      <span data-testid="learning">{props.learning as string}</span>
      {typeof props.onDefrost === "function" && (
        <button
          data-testid={`defrost-${props.id}`}
          onClick={props.onDefrost as () => void}
          type="button"
        >
          Defrost
        </button>
      )}
      {typeof props.onSatisfactionFeedback === "function" && (
        <>
          <button
            data-testid={`fb-worth-${props.id}`}
            onClick={() =>
              (props.onSatisfactionFeedback as (v: string) => void)("worth_it")
            }
            type="button"
          >
            Worth it
          </button>
          <button
            data-testid={`fb-regret-${props.id}`}
            onClick={() =>
              (props.onSatisfactionFeedback as (v: string) => void)("regret_it")
            }
            type="button"
          >
            Regret it
          </button>
        </>
      )}
    </article>
  ),
}));

import { GhostCardFeed } from "./ghost-card-feed";
import { GhostCardManagerProvider } from "./ghost-card-manager";

function makeApiCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "gc-1",
    interactionId: "int-1",
    status: "pending",
    satisfactionFeedback: null,
    createdAt: new Date().toISOString(),
    tier: "negotiator",
    outcome: "accepted",
    purchaseContext: {
      itemName: "Headphones",
      price: 18_000,
      merchant: "BestBuy",
    },
    ...overrides,
  };
}

function renderFeed(props: { guardianActive?: boolean } = {}) {
  return render(
    <GhostCardManagerProvider>
      <GhostCardFeed {...props} />
    </GhostCardManagerProvider>
  );
}

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  mockRequestDefrost.mockClear();
  mockReportFrosted.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GhostCardFeed", () => {
  // ========================================================================
  // Loading State (AC1)
  // ========================================================================

  it("shows skeleton during loading", () => {
    mockFetch.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      })
    );
    renderFeed();

    expect(screen.getByTestId("ghost-feed-skeleton")).toBeInTheDocument();
  });

  // ========================================================================
  // Renders Cards (AC1)
  // ========================================================================

  it("renders ghost cards from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({ id: "gc-1" }),
            makeApiCard({
              id: "gc-2",
              purchaseContext: {
                itemName: "Shoes",
                price: 9900,
                merchant: "Nike",
              },
            }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toBeInTheDocument();
      expect(screen.getByTestId("ghost-card-gc-2")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Empty State (AC8)
  // ========================================================================

  it("shows empty state when no cards", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-feed-empty")).toBeInTheDocument();
      expect(
        screen.getByText("Your spending reflections will appear here")
      ).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Pagination (AC2)
  // ========================================================================

  it("shows 'Load more' button when hasMore is true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [makeApiCard()],
          nextCursor: "2026-01-01T00:00:00Z|gc-10",
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
  });

  it("does not show 'Load more' when no more pages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("fetches next page with cursor when 'Load more' clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cards: [makeApiCard({ id: "gc-1" })],
            nextCursor: "2026-01-01T00:00:00Z|gc-1",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cards: [
              makeApiCard({
                id: "gc-2",
                purchaseContext: {
                  itemName: "Shoes",
                  price: 5000,
                  merchant: "Nike",
                },
              }),
            ],
            nextCursor: null,
          }),
      });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Load more"));

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-2")).toBeInTheDocument();
    });

    // Verify cursor was passed
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain("cursor=");
  });

  // ========================================================================
  // Data Mapping (AC3)
  // ========================================================================

  it("suppresses cards with missing purchaseContext", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({ id: "gc-1" }),
            makeApiCard({ id: "gc-missing", purchaseContext: null }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("ghost-card-gc-missing")).toBeNull();
  });

  it("suppresses cards with missing itemName", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({
              id: "gc-no-item",
              purchaseContext: { price: 5000, merchant: "Store" },
            }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-feed-empty")).toBeInTheDocument();
    });
  });

  it("maps state to feedback_given when satisfactionFeedback present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({ id: "gc-fb", satisfactionFeedback: "worth_it" }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-fb")).toHaveAttribute(
        "data-state",
        "feedback_given"
      );
    });
  });

  it("maps state to frosted when no satisfactionFeedback", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [makeApiCard({ id: "gc-fr", satisfactionFeedback: null })],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-fr")).toHaveAttribute(
        "data-state",
        "frosted"
      );
    });
  });

  it("maps override outcomes to override tierOrigin", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [makeApiCard({ id: "gc-ov", outcome: "overridden" })],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-ov")).toHaveAttribute(
        "data-tier",
        "override"
      );
    });
  });

  it("maps therapist tier correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({
              id: "gc-th",
              tier: "therapist",
              outcome: "accepted",
            }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-th")).toHaveAttribute(
        "data-tier",
        "therapist"
      );
    });
  });

  it("formats price from cents to dollars", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            makeApiCard({
              id: "gc-p",
              purchaseContext: {
                itemName: "Widget",
                price: 12_345,
                merchant: "Shop",
              },
            }),
          ],
          nextCursor: null,
        }),
    });

    renderFeed();

    await waitFor(() => {
      const dataEl = screen
        .getByTestId("ghost-card-gc-p")
        .querySelector('[data-testid="data"]');
      expect(dataEl?.textContent).toBe("$123.45");
    });
  });

  // ========================================================================
  // Feedback Submission (AC4)
  // ========================================================================

  it("optimistically updates card on feedback submission", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cards: [makeApiCard({ id: "gc-opt" })],
            nextCursor: null,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-opt")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("fb-worth-gc-opt"));

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-opt")).toHaveAttribute(
        "data-state",
        "feedback_given"
      );
    });
  });

  it("reverts optimistic update on PATCH error", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cards: [makeApiCard({ id: "gc-err" })],
            nextCursor: null,
          }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-err")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("fb-worth-gc-err"));

    // After error, state should revert to frosted
    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-err")).toHaveAttribute(
        "data-state",
        "frosted"
      );
    });
  });

  it("sets isSubmitting during PATCH request", async () => {
    const deferred = {
      resolve: (_v: unknown) => {
        /* placeholder */
      },
    };
    const patchPromise = new Promise((r) => {
      deferred.resolve = r;
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cards: [makeApiCard({ id: "gc-sub" })],
            nextCursor: null,
          }),
      })
      .mockReturnValueOnce(patchPromise);

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-sub")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("fb-worth-gc-sub"));

    // While PATCH is in-flight, isSubmitting should be true
    expect(screen.getByTestId("ghost-card-gc-sub")).toHaveAttribute(
      "data-submitting",
      "true"
    );

    // Resolve PATCH
    deferred.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-sub")).toHaveAttribute(
        "data-submitting",
        "false"
      );
    });
  });

  // ========================================================================
  // Feed Freeze (AC7)
  // ========================================================================

  it("sets inert attribute when guardianActive is true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed({ guardianActive: true });

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toBeInTheDocument();
    });

    const feed = screen.getByRole("feed");
    expect(feed.hasAttribute("inert")).toBe(true);
  });

  it("removes inert attribute when guardianActive is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed({ guardianActive: false });

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toBeInTheDocument();
    });

    const feed = screen.getByRole("feed");
    expect(feed.hasAttribute("inert")).toBe(false);
  });

  // ========================================================================
  // Defrost Integration (AC5)
  // ========================================================================

  it("calls requestDefrost via manager when onDefrost fires", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("defrost-gc-1")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("defrost-gc-1"));
    expect(mockRequestDefrost).toHaveBeenCalledWith("gc-1");
  });

  it("transitions card state to revealed when requestDefrost returns true", async () => {
    mockRequestDefrost.mockReturnValue(true);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toHaveAttribute(
        "data-state",
        "frosted"
      );
    });

    await userEvent.click(screen.getByTestId("defrost-gc-1"));

    expect(screen.getByTestId("ghost-card-gc-1")).toHaveAttribute(
      "data-state",
      "revealed"
    );
  });

  it("keeps card frosted when requestDefrost returns false", async () => {
    mockRequestDefrost.mockReturnValue(false);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByTestId("ghost-card-gc-1")).toHaveAttribute(
        "data-state",
        "frosted"
      );
    });

    await userEvent.click(screen.getByTestId("defrost-gc-1"));

    expect(screen.getByTestId("ghost-card-gc-1")).toHaveAttribute(
      "data-state",
      "frosted"
    );
  });

  // ========================================================================
  // Accessibility (AC10)
  // ========================================================================

  it("has role=feed and aria-label on container", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ cards: [makeApiCard()], nextCursor: null }),
    });

    renderFeed();

    await waitFor(() => {
      const feed = screen.getByRole("feed");
      expect(feed).toBeInTheDocument();
      expect(feed.getAttribute("aria-label")).toBe("Past spending reflections");
    });
  });

  it("has aria-live region for load-more announcements", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [makeApiCard()],
          nextCursor: "cursor-123",
        }),
    });

    renderFeed();

    await waitFor(() => {
      const liveRegion = screen.getByText("Load more").closest("[aria-live]");
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
    });
  });
});
