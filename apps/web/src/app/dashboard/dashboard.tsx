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
    <div
      className="flex flex-col gap-4 px-4 pt-4"
      data-testid="dashboard-skeleton"
      style={{ maxWidth: "960px", margin: "0 auto", width: "100%" }}
    >
      {/* Card Vault placeholder */}
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl"
        style={{
          maxWidth: "28rem",
          aspectRatio: "1.586",
          background:
            "linear-gradient(145deg, oklch(0.18 0.03 250 / 60%), oklch(0.12 0.02 250 / 40%))",
          border: "1px solid oklch(1 0 0 / 0.06)",
        }}
      >
        {/* Shimmer sweep */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.04) 40%, oklch(1 0 0 / 0.08) 50%, oklch(1 0 0 / 0.04) 60%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s infinite linear",
          }}
        />
        {/* Chip placeholder */}
        <div className="p-6">
          <Skeleton
            className="h-10 w-12 rounded-lg"
            style={{ background: "oklch(1 0 0 / 0.06)" }}
          />
        </div>
        {/* Card number placeholder */}
        <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between">
          <Skeleton
            className="h-5 w-48 rounded"
            style={{ background: "oklch(1 0 0 / 0.06)" }}
          />
          <Skeleton
            className="h-4 w-16 rounded"
            style={{ background: "oklch(1 0 0 / 0.04)" }}
          />
        </div>
      </div>

      {/* Summary card placeholder */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "oklch(0.16 0.008 250 / 40%)",
          border: "1px solid oklch(1 0 0 / 0.04)",
        }}
      >
        <div className="flex items-center justify-between">
          <Skeleton
            className="h-4 w-24 rounded"
            style={{ background: "oklch(1 0 0 / 0.06)" }}
          />
          <Skeleton
            className="h-4 w-16 rounded"
            style={{ background: "oklch(1 0 0 / 0.04)" }}
          />
        </div>
        <Skeleton
          className="mt-3 h-8 w-32 rounded"
          style={{ background: "oklch(1 0 0 / 0.06)" }}
        />
      </div>

      {/* Stats row placeholders */}
      <div className="grid grid-cols-3 gap-3">
        {["saved", "blocked", "streak"].map((id) => (
          <div
            className="rounded-xl p-3"
            key={id}
            style={{
              background: "oklch(0.16 0.008 250 / 30%)",
              border: "1px solid oklch(1 0 0 / 0.03)",
            }}
          >
            <Skeleton
              className="mb-2 h-3 w-12 rounded"
              style={{ background: "oklch(1 0 0 / 0.05)" }}
            />
            <Skeleton
              className="h-5 w-16 rounded"
              style={{ background: "oklch(1 0 0 / 0.06)" }}
            />
          </div>
        ))}
      </div>

      {/* Interaction list placeholders */}
      {[
        { id: "recent-1", opacity: 1 },
        { id: "recent-2", opacity: 0.8 },
        { id: "recent-3", opacity: 0.6 },
      ].map((row) => (
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          key={row.id}
          style={{
            background: "oklch(0.16 0.008 250 / 20%)",
            border: "1px solid oklch(1 0 0 / 0.03)",
            opacity: row.opacity,
          }}
        >
          <Skeleton
            className="h-8 w-8 rounded-full"
            style={{ background: "oklch(1 0 0 / 0.06)" }}
          />
          <div className="flex-1">
            <Skeleton
              className="mb-1.5 h-3.5 w-32 rounded"
              style={{ background: "oklch(1 0 0 / 0.06)" }}
            />
            <Skeleton
              className="h-3 w-20 rounded"
              style={{ background: "oklch(1 0 0 / 0.04)" }}
            />
          </div>
          <Skeleton
            className="h-4 w-12 rounded"
            style={{ background: "oklch(1 0 0 / 0.04)" }}
          />
        </div>
      ))}
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
        <div id="tour-savings">
          <SavingsCounter totalCents={savingsData.totalCents} />
          <SavingsBreakdown
            avgCents={savingsData.avgCents}
            dealCount={savingsData.dealCount}
            sourceBreakdown={savingsData.sourceBreakdown}
            totalCents={savingsData.totalCents}
          />
        </div>
      )}

      <StatsPanel
        goodFrictionScore={Math.round(data.acceptanceRate)}
        hidden={false}
        pauses={data.interactionCount}
        sparklineData={[]}
        streak={0}
        totalSavedCents={data.totalSavedCents}
      />

      <div id="tour-history">
        <RecentInteractions interactions={data.recentInteractions} />
      </div>

      {referralData?.shouldShow && (
        <ReferralCard
          consecutiveOverrides={referralData.consecutiveOverrides}
        />
      )}

      <div id="tour-ghost-cards">
        <GhostCardManagerProvider>
          <GhostCardFeed />
        </GhostCardManagerProvider>
      </div>
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
