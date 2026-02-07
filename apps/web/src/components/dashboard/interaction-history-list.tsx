"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { InteractionDetail } from "./interaction-detail";
import { InteractionRow } from "./interaction-row";

interface InteractionItem {
  id: string;
  tier: string;
  outcome: string | null;
  reasoningSummary: string | null;
  createdAt: string;
  savingsAmountCents: number | null;
  couponCode: string | null;
  purchaseContext: {
    itemName?: string;
    merchant?: string;
    category?: string;
    price?: number;
  } | null;
}

interface ApiResponse {
  interactions: InteractionItem[];
  nextCursor: string | null;
}

function InteractionSkeleton() {
  return (
    <div className="flex flex-col gap-1" data-testid="interaction-skeleton">
      {["sk-a", "sk-b", "sk-c", "sk-d", "sk-e"].map((id) => (
        <div className="flex items-center gap-3 px-3 py-2.5" key={id}>
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function InteractionHistoryList() {
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchInteractions = useCallback(async (cursor?: string | null) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.set("cursor", cursor);
      }
      const res = await fetch(`/api/ai/interactions?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load interactions");
      }
      const data: ApiResponse = await res.json();
      if (isLoadMore) {
        setInteractions((prev) => [...prev, ...data.interactions]);
      } else {
        setInteractions(data.interactions);
      }
      setNextCursor(data.nextCursor);
      setError(null);
    } catch {
      setError("Unable to load interactions");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasFetched(true);
    }
  }, []);

  // Fetch on mount
  const mountRef = useCallback(
    (node: HTMLElement | null) => {
      if (node && !hasFetched) {
        fetchInteractions();
      }
    },
    [hasFetched, fetchInteractions]
  );

  if (isLoading && !hasFetched) {
    return (
      <div ref={mountRef}>
        <InteractionSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="py-6 text-center text-muted-foreground text-sm"
        data-testid="interaction-error"
        ref={mountRef}
      >
        {error}
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div
        className="py-6 text-center text-muted-foreground text-sm"
        data-testid="interaction-empty"
        ref={mountRef}
      >
        No unlock requests yet. Tap your card to try it out!
      </div>
    );
  }

  return (
    <div ref={mountRef}>
      <ul
        aria-label="Interaction history"
        className="flex list-none flex-col gap-0.5"
      >
        {interactions.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <li key={item.id}>
              <InteractionRow
                interaction={item}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : item.id)}
              />
              {isExpanded && (
                <InteractionDetail
                  couponCode={item.couponCode}
                  outcome={item.outcome}
                  reasoningSummary={item.reasoningSummary}
                  savingsAmountCents={item.savingsAmountCents}
                  tier={item.tier}
                />
              )}
            </li>
          );
        })}
      </ul>

      {nextCursor && (
        <div className="flex justify-center py-3">
          <Button
            data-testid="load-more-button"
            disabled={isLoadingMore}
            onClick={() => fetchInteractions(nextCursor)}
            variant="ghost"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
