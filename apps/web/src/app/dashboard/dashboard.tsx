"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { RecentInteractions } from "@/components/dashboard/recent-interactions";
import { ReferralCard } from "@/components/dashboard/referral-card";
import { SavingsBreakdown } from "@/components/dashboard/savings-breakdown";
import { SavingsCounter } from "@/components/dashboard/savings-counter";
import { SavingsSummary } from "@/components/dashboard/savings-summary";
import { CommandCenter } from "@/components/guardian/command-center";
import { GhostCardFeed } from "@/components/guardian/ghost-card-feed";
import { GhostCardManagerProvider } from "@/components/guardian/ghost-card-manager";
import { StatsPanel } from "@/components/guardian/stats-panel";
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

  const { data: cardData, isLoading: cardLoading } = useQuery(
    trpc.dashboard.getCard.queryOptions()
  );

  const { data: savingsData, isLoading: savingsLoading } = useQuery({
    ...trpc.savings.getSummary.queryOptions(),
    staleTime: 30_000,
  });

  const { data: referralData } = useQuery({
    ...trpc.dashboard.referralStatus.queryOptions(),
    staleTime: 60_000,
  });

  const celebrating = useFirstInteractionCelebration(
    data?.interactionCount ?? 0
  );

  useEffect(() => {
    if (error) {
      console.error("Dashboard query failed:", error);
    }
  }, [error]);

  if (isLoading || cardLoading) {
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

  // Map DB card to CardVault's CardData shape
  const card = cardData
    ? {
        id: cardData.id,
        userId: cardData.userId,
        lastFour: cardData.lastFour,
        nickname: cardData.nickname,
        status: cardData.status as "active" | "locked" | "removed",
        lockedAt: cardData.lockedAt ? new Date(cardData.lockedAt) : null,
        unlockedAt: cardData.unlockedAt ? new Date(cardData.unlockedAt) : null,
        createdAt: new Date(cardData.createdAt),
        updatedAt: new Date(cardData.updatedAt),
      }
    : null;

  const feedContent = (
    <div
      className="flex flex-col gap-3 px-4 pb-4"
      data-celebrate={celebrating || undefined}
      data-testid="dashboard-feed"
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
        animation: celebrating ? "celebrate-pulse 0.3s ease-out" : undefined,
      }}
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

      <StatsPanel
        goodFrictionScore={Math.round(data.acceptanceRate)}
        hidden={false}
        pauses={data.interactionCount}
        sparklineData={[]}
        streak={0}
        totalSavedCents={data.totalSavedCents}
      />

      <RecentInteractions interactions={data.recentInteractions} />

      {referralData?.shouldShow && (
        <ReferralCard
          consecutiveOverrides={referralData.consecutiveOverrides}
        />
      )}

      <GhostCardManagerProvider>
        <GhostCardFeed />
      </GhostCardManagerProvider>
    </div>
  );

  return (
    <CommandCenter
      card={card}
      cardId={cardData?.id}
      feedContent={feedContent}
    />
  );
}
