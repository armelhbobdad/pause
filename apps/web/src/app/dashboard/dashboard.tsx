"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { RecentInteractions } from "@/components/dashboard/recent-interactions";
import { SavingsBreakdown } from "@/components/dashboard/savings-breakdown";
import { SavingsCounter } from "@/components/dashboard/savings-counter";
import { SavingsSummary } from "@/components/dashboard/savings-summary";
import { GhostCardFeed } from "@/components/guardian/ghost-card-feed";
import { GhostCardManagerProvider } from "@/components/guardian/ghost-card-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirstInteractionCelebration } from "@/hooks/use-first-interaction-celebration";
import { trpc } from "@/utils/trpc";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="dashboard-skeleton">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.dashboard.summary.queryOptions(),
    refetchOnWindowFocus: true,
  });

  const { data: savingsData, isLoading: savingsLoading } = useQuery({
    ...trpc.savings.getSummary.queryOptions(),
    staleTime: 30_000,
  });

  const celebrating = useFirstInteractionCelebration(
    data?.interactionCount ?? 0
  );

  useEffect(() => {
    if (error) {
      console.error("Dashboard query failed:", error);
    }
  }, [error]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-12 text-center"
        data-testid="dashboard-error"
      >
        <p className="text-muted-foreground text-sm">
          Unable to load dashboard. Pull to refresh.
        </p>
        <button
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm"
          onClick={() => refetch()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isNewUser = data.interactionCount === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Card Vault area (~40vh) — read-only resting state */}
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="text-muted-foreground text-sm">Card Vault</div>
        {(isNewUser || celebrating) && (
          <p
            className="text-muted-foreground text-sm"
            data-celebrate={celebrating || undefined}
            data-testid="onboarding-prompt"
            style={{
              opacity: celebrating ? 0 : 0.8,
              transition: celebrating
                ? "opacity 0.5s var(--ease-out-expo)"
                : undefined,
            }}
          >
            Tap to meet your Guardian
          </p>
        )}
      </div>

      {/* Scrollable feed (~60vh) */}
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
        data-celebrate={celebrating || undefined}
        style={
          celebrating
            ? {
                animation: "celebrate-pulse 0.3s ease-out",
              }
            : undefined
        }
      >
        <SavingsSummary
          acceptanceRate={data.acceptanceRate}
          interactionCount={data.interactionCount}
          totalSavedCents={data.totalSavedCents}
        />

        {!savingsLoading && savingsData && (
          <>
            <SavingsCounter totalCents={savingsData.totalCents} />
            <SavingsBreakdown
              avgCents={savingsData.avgCents}
              dealCount={savingsData.dealCount}
              sourceBreakdown={savingsData.sourceBreakdown}
              totalCents={savingsData.totalCents}
            />
          </>
        )}

        <RecentInteractions interactions={data.recentInteractions} />

        <GhostCardManagerProvider>
          <GhostCardFeed />
        </GhostCardManagerProvider>
      </div>
    </div>
  );
}
