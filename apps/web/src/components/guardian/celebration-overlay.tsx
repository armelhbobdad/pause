"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

type CelebrationRevealType = "earned" | "wait-expired";

export interface CelebrationOverlayProps {
  /** Type of reveal: "earned" = full confetti, "wait-expired" = gentle, no confetti */
  revealType: CelebrationRevealType;
  /** Savings amount in cents from DB */
  amountCents: number;
  /** Duration of the Guardian pause session in seconds */
  pauseDurationSeconds: number;
  /** Number of mindful spending days */
  mindfulDays: number;
  /** Callback when "Back to Dashboard" is pressed — dispatches RELOCK */
  onDismiss: () => void;
}

// ============================================================================
// Confetti Particle Generator
// ============================================================================

const PARTICLE_COUNT = 30;

const CONFETTI_COLORS = [
  "var(--pause-success)",
  "var(--savings-gold)",
  "oklch(0.7 0.15 250)",
  "oklch(0.75 0.18 330)",
  "oklch(0.8 0.12 180)",
];

function generateParticleStyles(): Array<{
  left: string;
  animationDelay: string;
  animationDuration: string;
  backgroundColor: string;
  width: string;
  height: string;
  initialRotation: number;
}> {
  const particles: Array<{
    left: string;
    animationDelay: string;
    animationDuration: string;
    backgroundColor: string;
    width: string;
    height: string;
    initialRotation: number;
  }> = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      left: `${(i / PARTICLE_COUNT) * 100 + Math.random() * (100 / PARTICLE_COUNT)}%`,
      animationDelay: `${Math.random() * 1.5}s`,
      animationDuration: `${1.5 + Math.random() * 2}s`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: `${6 + Math.random() * 6}px`,
      height: `${6 + Math.random() * 6}px`,
      initialRotation: Math.random() * 360,
    });
  }
  return particles;
}

// ============================================================================
// Savings Counter Hook
// ============================================================================

function useSavingsCounter(
  targetDollars: number,
  enabled: boolean
): {
  displayValue: number;
  isAnimating: boolean;
} {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || targetDollars <= 0) {
      setDisplayValue(targetDollars);
      return;
    }

    setIsAnimating(true);
    const startTime = performance.now();
    const duration = 800;
    const startValue = 0;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out: 1 - (1 - p)^3
      const eased = 1 - (1 - progress) ** 3;
      const current = startValue + (targetDollars - startValue) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetDollars);
        setIsAnimating(false);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetDollars, enabled]);

  return { displayValue, isAnimating };
}

// ============================================================================
// Visibility-Aware Timer Hook
// ============================================================================

function useVisibilityAwareTimer(
  durationMs: number,
  onComplete: () => void
): { ready: boolean } {
  const [ready, setReady] = useState(false);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    lastTickRef.current = Date.now();

    function tick() {
      if (document.visibilityState === "hidden") {
        lastTickRef.current = Date.now();
        return;
      }
      const now = Date.now();
      elapsedRef.current += now - lastTickRef.current;
      lastTickRef.current = now;

      if (elapsedRef.current >= durationMs) {
        setReady(true);
        onComplete();
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
        }
      }
    }

    intervalRef.current = setInterval(tick, 100);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastTickRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [durationMs, onComplete]);

  return { ready };
}

// ============================================================================
// Confetti Particles Component
// ============================================================================

const particleStyles = generateParticleStyles();

function ConfettiParticles() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "50%",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {particleStyles.map((p, i) => (
        <span
          data-confetti
          key={`confetti-${i.toString()}`}
          style={{
            position: "absolute",
            top: "-10px",
            left: p.left,
            width: p.width,
            height: p.height,
            backgroundColor: p.backgroundColor,
            borderRadius: "2px",
            animation: `confetti-fall ${p.animationDuration} ${p.animationDelay} ease-in forwards`,
            transform: `rotate(${p.initialRotation.toString()}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(50vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// CelebrationOverlay Component
// ============================================================================

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function CelebrationOverlay({
  revealType,
  amountCents,
  pauseDurationSeconds,
  mindfulDays,
  onDismiss,
}: CelebrationOverlayProps) {
  const shouldReduceMotion = useReducedMotion();
  const [timerComplete, setTimerComplete] = useState(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const targetDollars = amountCents / 100;

  const handleTimerComplete = useCallback(() => {
    setTimerComplete(true);
  }, []);

  useVisibilityAwareTimer(3000, handleTimerComplete);

  const { displayValue, isAnimating } = useSavingsCounter(
    targetDollars,
    !shouldReduceMotion
  );

  // Auto-focus "Back to Dashboard" when timer completes
  useEffect(() => {
    if (timerComplete && dismissButtonRef.current) {
      dismissButtonRef.current.focus();
    }
  }, [timerComplete]);

  const isEarned = revealType === "earned";
  const showConfetti = isEarned && !shouldReduceMotion;
  const accentColor = isEarned ? "var(--pause-success)" : "var(--foreground)";

  return (
    <div
      data-testid="celebration-overlay"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--pause-scrim)",
        zIndex: "var(--z-overlay)",
      }}
    >
      {/* Confetti — top half, earned only */}
      {showConfetti && <ConfettiParticles />}

      {/* Content — bottom half with higher z-index */}
      <output
        aria-live="assertive"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-8)",
          textAlign: "center",
        }}
      >
        {/* Reduced motion: static badge */}
        {shouldReduceMotion ? (
          <div
            data-testid="static-saved-badge"
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: accentColor,
              padding: "var(--space-4) var(--space-8)",
              border: `2px solid ${accentColor}`,
              borderRadius: "0.5rem",
            }}
          >
            Saved!
          </div>
        ) : null}

        {/* Savings counter tick-up */}
        <div
          data-testid="savings-counter"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "3rem",
            fontWeight: "bold",
            fontVariantNumeric: "tabular-nums",
            color: isAnimating ? "var(--pause-success)" : "var(--foreground)",
            transition: "color 300ms ease-out",
          }}
        >
          {shouldReduceMotion
            ? currencyFormatter.format(targetDollars)
            : currencyFormatter.format(displayValue)}
        </div>

        {/* Session summary */}
        <p
          data-testid="session-summary"
          style={{
            fontFamily: "var(--font-conversation)",
            fontSize: "1rem",
            color: "var(--foreground)",
            opacity: 0.85,
            maxWidth: "320px",
            lineHeight: 1.5,
          }}
        >
          You paused for {pauseDurationSeconds}s. That&apos;s{" "}
          {currencyFormatter.format(targetDollars)} saved and {mindfulDays}{" "}
          {mindfulDays === 1 ? "day" : "days"} of mindful spending.
        </p>

        {/* Back to Dashboard button */}
        {timerComplete && (
          <button
            data-testid="dismiss-button"
            onClick={onDismiss}
            ref={dismissButtonRef}
            style={{
              marginTop: "var(--space-4)",
              padding: "0.75rem 2rem",
              minHeight: "48px",
              border: "none",
              borderRadius: "0.5rem",
              backgroundColor: accentColor,
              color: "white",
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: "pointer",
            }}
            type="button"
          >
            Back to Dashboard
          </button>
        )}
      </output>
    </div>
  );
}
