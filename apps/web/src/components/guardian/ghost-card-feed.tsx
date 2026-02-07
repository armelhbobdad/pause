"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GhostCardProps } from "./ghost-card";
import { GhostCard } from "./ghost-card";
import { useGhostCardManager } from "./ghost-card-manager";

interface GhostCardApiResponse {
  id: string;
  interactionId: string;
  status: string;
  satisfactionFeedback: string | null;
  createdAt: string;
  tier: string;
  outcome: string | null;
  purchaseContext: {
    itemName?: string;
    price?: number;
    merchant?: string;
  } | null;
}

interface FetchResponse {
  cards: GhostCardApiResponse[];
  nextCursor: string | null;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diff < 3_600_000) {
    return rtf.format(-Math.round(diff / 60_000), "minute");
  }
  if (diff < 86_400_000) {
    return rtf.format(-Math.round(diff / 3_600_000), "hour");
  }
  return rtf.format(-Math.round(diff / 86_400_000), "day");
}

function mapTierOrigin(
  tier: string,
  outcome: string | null
): GhostCardProps["tierOrigin"] {
  if (outcome === "overridden" || outcome === "break_glass") {
    return "override";
  }
  if (tier === "therapist") {
    return "therapist";
  }
  return "negotiator";
}

function mapToGhostCardProps(
  card: GhostCardApiResponse
): GhostCardProps | null {
  if (!card.purchaseContext?.itemName || card.purchaseContext?.price == null) {
    return null;
  }

  const pc = card.purchaseContext;
  const price = pc.price as number;
  return {
    id: card.id,
    state: card.satisfactionFeedback ? "feedback_given" : "frosted",
    recall: `${pc.itemName} from ${pc.merchant ?? "your purchase"} — ${relativeTime(card.createdAt)}`,
    data: formatPrice(price),
    learning: "Skillbook is studying this pattern.",
    tierOrigin: mapTierOrigin(card.tier, card.outcome),
    satisfactionFeedback:
      card.satisfactionFeedback as GhostCardProps["satisfactionFeedback"],
    category: undefined,
  };
}

function FeedSkeleton() {
  return (
    <div
      data-testid="ghost-feed-skeleton"
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: "120px",
            borderRadius: "0.5rem",
            backgroundColor: "var(--muted, #1a1a2e)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="ghost-feed-empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        padding: "2rem 1rem",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: "2rem",
          opacity: 0.6,
        }}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="48"
          viewBox="0 0 48 48"
          width="48"
        >
          <circle
            cx="24"
            cy="24"
            opacity="0.3"
            r="20"
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
          <path
            d="M18 24h12M24 18v12"
            opacity="0.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      <p
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "0.9375rem",
          color: "oklch(0.65 0.02 250)",
          lineHeight: 1.5,
          maxWidth: "280px",
        }}
      >
        Your spending reflections will appear here
      </p>
    </div>
  );
}

export function GhostCardFeed({
  guardianActive = false,
}: {
  guardianActive?: boolean;
}) {
  const [cards, setCards] = useState<GhostCardApiResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [optimisticFeedback, setOptimisticFeedback] = useState<
    Map<string, string>
  >(() => new Map());
  const [submittingCards, setSubmittingCards] = useState<Set<string>>(
    () => new Set()
  );

  const feedRef = useRef<HTMLDivElement>(null);
  const manager = useGhostCardManager();

  // Feed freeze with inert attribute
  useEffect(() => {
    if (feedRef.current) {
      if (guardianActive) {
        feedRef.current.setAttribute("inert", "");
      } else {
        feedRef.current.removeAttribute("inert");
      }
    }
  }, [guardianActive]);

  const fetchCards = useCallback(async (cursorParam?: string | null) => {
    const url = cursorParam
      ? `/api/ai/ghost-cards?cursor=${encodeURIComponent(cursorParam)}`
      : "/api/ai/ghost-cards";

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch ghost cards");
    }
    return (await response.json()) as FetchResponse;
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchCards()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setCards(data.cards);
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      })
      .catch(() => {
        // Silently fail — empty state will show
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchCards]);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const data = await fetchCards(cursor);
      setCards((prev) => [...prev, ...data.cards]);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, fetchCards]);

  const handleSatisfactionFeedback = useCallback(
    async (
      cardId: string,
      satisfaction: "worth_it" | "regret_it" | "not_sure" | null
    ) => {
      if (satisfaction === null) {
        // "Change" was clicked — clear optimistic feedback
        setOptimisticFeedback((prev) => {
          const m = new Map(prev);
          m.delete(cardId);
          return m;
        });
        return;
      }

      // Optimistic update
      setOptimisticFeedback((prev) => new Map(prev).set(cardId, satisfaction));
      setSubmittingCards((prev) => new Set(prev).add(cardId));

      try {
        const res = await fetch(`/api/ai/ghost-cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ satisfactionFeedback: satisfaction }),
        });
        if (!res.ok) {
          throw new Error("Failed to save feedback");
        }
      } catch {
        // Revert optimistic update
        setOptimisticFeedback((prev) => {
          const m = new Map(prev);
          m.delete(cardId);
          return m;
        });
      } finally {
        setSubmittingCards((prev) => {
          const s = new Set(prev);
          s.delete(cardId);
          return s;
        });
      }
    },
    []
  );

  // Map cards to props, filter incomplete
  const mappedCards = cards
    .map((card) => {
      const optFeedback = optimisticFeedback.get(card.id);
      const effectiveCard = optFeedback
        ? { ...card, satisfactionFeedback: optFeedback }
        : card;
      return mapToGhostCardProps(effectiveCard);
    })
    .filter((c): c is GhostCardProps => c !== null);

  const showEmpty = !isLoading && mappedCards.length === 0 && !hasMore;

  return (
    <div
      aria-label="Past spending reflections"
      ref={feedRef}
      role="feed"
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      {isLoading && <FeedSkeleton />}
      {showEmpty && <EmptyState />}
      {!isLoading &&
        mappedCards.map((props) => (
          <GhostCard
            key={props.id}
            {...props}
            isSubmitting={submittingCards.has(props.id)}
            onDefrost={() => {
              manager.requestDefrost(props.id);
            }}
            onSatisfactionFeedback={(satisfaction) => {
              handleSatisfactionFeedback(props.id, satisfaction);
            }}
          />
        ))}
      {hasMore && (
        <div aria-live="polite">
          <button
            disabled={isLoadingMore}
            onClick={loadMore}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid var(--card-border)",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              color: "oklch(0.75 0.02 250)",
              fontFamily: "var(--font-conversation)",
              fontSize: "0.875rem",
              cursor: isLoadingMore ? "not-allowed" : "pointer",
              opacity: isLoadingMore ? 0.5 : 1,
            }}
            type="button"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
