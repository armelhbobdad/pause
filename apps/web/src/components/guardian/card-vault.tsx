"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { KeyboardEvent, MouseEvent } from "react";
import { CountdownTimer } from "@/components/guardian/countdown-timer";
import { Skeleton } from "@/components/ui/skeleton";
import type { RevealType } from "@/lib/guardian/types";
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

// RevealType imported from @/lib/guardian/types (canonical definition)
export type { RevealType } from "@/lib/guardian/types";

export interface CardVaultProps {
  card: CardData | null;
  onUnlockRequest?: () => void;
  className?: string;
  /** When true, Guardian is processing the unlock request - shows pulse animation */
  isActive?: boolean;
  /** When true, card details are revealed (frost overlay fades out) */
  isRevealed?: boolean;
  /** Type of reveal determines animation timing: "earned" (warm snap) or "override" (mechanical) */
  revealType?: RevealType | null;
  /** When true, shows countdown timer at card bottom after reveal */
  showCountdown?: boolean;
  /** Countdown duration in milliseconds (default: 60000ms per executive function window) */
  countdownDuration?: number;
  /** Callback when countdown timer expires */
  onCountdownExpire?: () => void;
}

// ============================================================================
// Card Visual Constants
// ============================================================================

const CARD_GRADIENT =
  "linear-gradient(145deg, oklch(0.25 0.06 250), oklch(0.16 0.03 250))";

const OVERLAY_LIGHTS = [
  "radial-gradient(circle at 20% 30%, oklch(0.9 0 0 / 0.06), transparent 55%)",
  "radial-gradient(circle at 80% 20%, oklch(0.5 0.12 250 / 0.25), transparent 60%)",
  "radial-gradient(circle at 50% 80%, oklch(0.5 0.08 280 / 0.18), transparent 65%)",
].join(",");

// ============================================================================
// Card Chip Component (glassmorphism chip element)
// ============================================================================

function CardChip() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="flex h-12 w-14 items-center justify-center rounded-lg border border-border/60 bg-foreground/15 backdrop-blur">
        <div className="h-8 w-10 rounded-md border border-border/40 bg-background/60" />
      </div>
      <div className="absolute right-0 -bottom-1 left-0 h-1 rounded-full bg-foreground/10" />
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
  isActive = false,
  isRevealed = false,
  revealType = null,
  showCountdown = false,
  countdownDuration = 60_000,
  onCountdownExpire,
}: CardVaultProps) {
  // 3D mouse-tracking hooks (must be before any conditional return)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), {
    stiffness: 280,
    damping: 28,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), {
    stiffness: 280,
    damping: 28,
  });
  const shouldReduceMotion = useReducedMotion();

  // Track duplicate tap attempts for subtle feedback (AC#4)
  // Counter changes the announcement text, triggering aria-live to re-announce
  const duplicateTapCountRef = { current: 0 };

  // Handle click - prevent duplicate requests when already active
  function handleClick() {
    if (isActive) {
      // Already processing - increment counter for subtle feedback
      duplicateTapCountRef.current += 1;
      return;
    }
    duplicateTapCountRef.current = 0;
    onUnlockRequest?.();
  }

  // Handle keyboard events for accessibility (Enter/Space trigger unlock request)
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isActive) {
        // Already processing - increment counter for subtle feedback
        duplicateTapCountRef.current += 1;
        return;
      }
      duplicateTapCountRef.current = 0;
      onUnlockRequest?.();
    }
  }

  // Mouse handlers for 3D card rotation effect
  function handleCardMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (shouldReduceMotion) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function handleCardMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // Empty state: no card linked
  if (card === null) {
    return <CardVaultEmpty className={className} />;
  }

  // Dynamic aria-label based on state
  function getAriaLabel() {
    if (isRevealed) {
      return "Payment card unlocked. Card details visible.";
    }
    if (isActive) {
      return "Guardian analyzing your request. Processing...";
    }
    return "Payment card locked. Tap to request unlock.";
  }
  const ariaLabel = getAriaLabel();

  // Screen reader announcement text based on state (UX-94, AC#2, Story 2-4 AC#3)
  function getLiveAnnouncement() {
    if (isRevealed) {
      // Differentiate override vs earned reveal announcements per Story 2-4 AC#3
      if (revealType === "override") {
        return "Card unlocked. You chose to skip the Guardian's suggestion.";
      }
      return "Card unlocked. Details now visible.";
    }
    if (isActive) {
      return "Guardian is analyzing your unlock request";
    }
    return "";
  }
  const liveAnnouncement = getLiveAnnouncement();

  return (
    // biome-ignore lint/a11y/useSemanticElements: Card vault requires fixed aspect ratio (1.586) and visual card appearance that buttons don't support. Uses aria-busy for processing state indication.
    <div
      aria-busy={isActive && !isRevealed}
      aria-label={ariaLabel}
      className={cn(
        "relative mx-auto w-full max-w-[28rem] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive && "animate-guardian-pulse",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      style={{ aspectRatio: "1.586", perspective: "1000px" }}
      tabIndex={0}
    >
      {/* Screen reader live region for status announcements (UX-94) */}
      <div aria-atomic="true" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* 3D card container with mouse-tracking rotation */}
      <motion.div
        className="absolute inset-0"
        onMouseLeave={handleCardMouseLeave}
        onMouseMove={handleCardMouseMove}
        style={{
          rotateX: shouldReduceMotion ? 0 : rotateX,
          rotateY: shouldReduceMotion ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Shadow glow behind card */}
        <div className="absolute inset-2 rounded-2xl bg-primary/15 blur-3xl" />

        {/* Card surface with glassmorphism */}
        <div
          className="absolute inset-0 overflow-hidden rounded-2xl"
          style={{
            background: CARD_GRADIENT,
            border: "1px solid oklch(0.45 0.06 250)",
            boxShadow:
              "0 0 40px oklch(0.4 0.1 250 / 0.25), 0 0 80px oklch(0.35 0.08 250 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.06), 0 22px 55px -30px rgba(15,23,42,0.75)",
          }}
        >
          {/* Overlay lights for glassmorphism depth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ background: OVERLAY_LIGHTS }}
          />

          {/* Card content: chip, last 4 digits, nickname */}
          <div className="relative z-10 flex h-full flex-col justify-between p-6">
            <CardChip />
            <div className="flex items-end justify-between">
              <span
                className="font-mono text-xl tracking-[0.2em] opacity-80"
                style={{ fontFamily: "var(--font-data)" }}
              >
                •••• •••• •••• {card.lastFour}
              </span>
              <span
                className="text-muted-foreground text-sm"
                style={{ fontFamily: "var(--font-conversation)" }}
              >
                {card.nickname ?? "My Card"}
              </span>
            </div>
          </div>

          {/* Frost overlay with opacity transition for reveal animation.
              Per UX-42: Animation targets opacity not blur amount for 60fps guarantee.
              backdrop-filter blur remains constant; opacity fades the overlay out. */}
          <div
            className="pointer-events-none absolute inset-0"
            data-frost-overlay
            data-revealed={isRevealed || undefined}
            style={
              {
                backdropFilter: "blur(var(--frost-blur))",
                WebkitBackdropFilter: "blur(var(--frost-blur))",
                opacity: "var(--frost-opacity)",
                transition:
                  revealType === "override" || revealType === "break_glass"
                    ? "--frost-opacity var(--duration-reveal-override) linear"
                    : "--frost-opacity var(--duration-reveal) var(--ease-out-expo)",
                "--frost-opacity": isRevealed ? 0 : 1,
              } as React.CSSProperties
            }
          />

          {/* Countdown timer appears at card bottom after reveal (UX-76)
              Shows executive function window before auto-relock.
              Break glass reveals skip timer — emergency unlock, not time-limited (Story 2.6 AC#2). */}
          {isRevealed && showCountdown && revealType !== "break_glass" && (
            <CountdownTimer
              durationMs={countdownDuration}
              onExpire={onCountdownExpire}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Export sub-components for external use
CardVault.Skeleton = CardVaultSkeleton;
CardVault.Empty = CardVaultEmpty;
