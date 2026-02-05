"use client";

import type { KeyboardEvent } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

/**
 * CardData type matching Drizzle schema from packages/db/src/schema/guardian.ts
 * Defined locally to avoid drizzle-orm dependency in web app.
 * SYNC: If db schema changes, update this type to match.
 */
export interface CardData {
  id: string;
  userId: string;
  lastFour: string;
  nickname: string | null;
  status: "active" | "locked" | "removed";
  lockedAt: Date | null;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardVaultProps {
  card: CardData | null;
  onUnlockRequest?: () => void;
  className?: string;
}

// ============================================================================
// Card Chip Component (CSS-only visual element)
// Note: Chip uses gold oklch colors (H=50) intentionally hardcoded - these are
// decorative chip element colors not part of the Guardian design token system.
// ============================================================================

const CHIP_GRADIENT =
  "linear-gradient(135deg, oklch(0.7 0.05 50) 0%, oklch(0.6 0.05 50) 100%)";
const CHIP_CELL_BG = "oklch(0.5 0.03 50)";

function CardChip() {
  return (
    <div
      aria-hidden="true"
      className="grid h-[30px] w-[40px] grid-cols-3 gap-[2px] rounded p-1"
      style={{ background: CHIP_GRADIENT }}
    >
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
      <div className="rounded-sm" style={{ background: CHIP_CELL_BG }} />
    </div>
  );
}

// ============================================================================
// Loading Skeleton State
// ============================================================================

function CardVaultSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative mx-auto w-full max-w-[28rem]", className)}
      style={{ aspectRatio: "1.586" }}
    >
      <Skeleton className="absolute inset-0 rounded-2xl" />
    </div>
  );
}

// ============================================================================
// Empty State (no card linked)
// ============================================================================

function CardVaultEmpty({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: Empty state requires div for aspect-ratio layout consistency with CardVault. Section element cannot accept style prop for aspect-ratio.
    <div
      aria-label="No card linked. Add a card to get started."
      className={cn("relative mx-auto w-full max-w-[28rem]", className)}
      role="region"
      style={{ aspectRatio: "1.586" }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed"
        style={{
          borderColor: "var(--card-border)",
          background: "var(--card-bg)",
        }}
      >
        {/* Plus icon */}
        <div
          aria-hidden="true"
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2"
          style={{ borderColor: "var(--card-border)" }}
        >
          <span className="text-2xl text-muted-foreground">+</span>
        </div>
        <span
          className="text-muted-foreground text-sm"
          style={{ fontFamily: "var(--font-conversation)" }}
        >
          Secure your first card.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Card Vault Component
// ============================================================================

export function CardVault({
  card,
  onUnlockRequest,
  className,
}: CardVaultProps) {
  // Handle keyboard events for accessibility (Enter/Space trigger unlock request)
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onUnlockRequest?.();
    }
  }

  // Empty state: no card linked
  if (card === null) {
    return <CardVaultEmpty className={className} />;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Card vault requires fixed aspect ratio (1.586) and visual card appearance that buttons don't support. Uses aria-disabled="true" per UX-93 for focusable-but-disabled semantic state.
    <div
      aria-disabled="true"
      aria-label="Payment card locked. Tap to request unlock."
      className={cn(
        "relative mx-auto w-full max-w-[28rem] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={() => onUnlockRequest?.()}
      onKeyDown={handleKeyDown}
      role="button"
      style={{ aspectRatio: "1.586" }}
      tabIndex={0}
    >
      {/* Card surface */}
      <div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        {/* Card content: chip, last 4 digits, nickname */}
        <div className="relative z-10 flex h-full flex-col justify-between p-6">
          <CardChip />
          <div className="flex items-end justify-between">
            {/* Last 4 digits - opacity-80 ensures visibility through frost blur while maintaining subtle effect */}
            <span
              className="text-xl opacity-80"
              style={{ fontFamily: "var(--font-data)" }}
            >
              •••• •••• •••• {card.lastFour}
            </span>
            {/* Card nickname */}
            <span
              className="text-muted-foreground text-sm"
              style={{ fontFamily: "var(--font-conversation)" }}
            >
              {card.nickname ?? "My Card"}
            </span>
          </div>
        </div>

        {/* Frost overlay (animatable for reveal in Story 2.3)
            This layer applies backdrop-filter blur over the card content.
            Set as a separate element to allow future opacity transitions. */}
        <div
          className="pointer-events-none absolute inset-0"
          data-frost-overlay
          style={{
            backdropFilter: "blur(var(--frost-blur))",
            WebkitBackdropFilter: "blur(var(--frost-blur))",
          }}
        />
      </div>
    </div>
  );
}

// Export sub-components for external use
CardVault.Skeleton = CardVaultSkeleton;
CardVault.Empty = CardVaultEmpty;
