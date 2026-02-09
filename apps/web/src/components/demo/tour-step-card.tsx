"use client";

import type { StepComponentProps } from "@onboardjs/react";
import { useOnboarding } from "@onboardjs/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTour } from "./tour-provider";

export interface TourStepPayload {
  title: string;
  content: string;
  targetId: string;
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * Glassmorphic tour step card rendered by OnboardJS.
 * Positions itself near the target element and highlights it with a spotlight.
 */
export function TourStepCard({ payload }: StepComponentProps<TourStepPayload>) {
  const { state, next, previous } = useOnboarding();
  const { stopTour } = useTour();
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStepNumber = state?.currentStepNumber ?? 1;
  const totalSteps = state?.totalSteps ?? 1;
  const isFirst = state?.isFirstStep ?? true;
  const isLast = state?.isLastStep ?? false;

  // Compute card + spotlight position from target element
  const computePosition = useCallback(() => {
    const targetEl = document.getElementById(payload.targetId);
    if (!targetEl) {
      setCardPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
      setTargetRect(null);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    setTargetRect(rect);

    const pos = payload.position ?? "bottom";
    const pad = 16;
    const cardW = 320;
    const cardH = 180;
    let top = 0;
    let left = 0;

    switch (pos) {
      case "top":
        top = rect.top - cardH - pad;
        left = rect.left + rect.width / 2 - cardW / 2;
        break;
      case "bottom":
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2 - cardW / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - cardH / 2;
        left = rect.left - cardW - pad;
        break;
      case "right":
        top = rect.top + rect.height / 2 - cardH / 2;
        left = rect.right + pad;
        break;
      default:
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2 - cardW / 2;
        break;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - cardH - 12));

    setCardPosition({ top, left });
  }, [payload.targetId, payload.position]);

  // Scroll target into view, then compute position after scroll settles
  useEffect(() => {
    const targetEl = document.getElementById(payload.targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Delay position calculation so scroll completes first
    const raf = requestAnimationFrame(() => {
      setTimeout(computePosition, 350);
    });
    return () => cancelAnimationFrame(raf);
  }, [payload.targetId, computePosition]);

  // Recompute on resize/scroll so spotlight stays aligned
  useEffect(() => {
    let ticking = false;
    function onUpdate() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          computePosition();
          ticking = false;
        });
      }
    }
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onUpdate, true);
    return () => {
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onUpdate, true);
    };
  }, [computePosition]);

  if (!cardPosition) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {/* Spotlight overlay */}
      <motion.div
        animate={{ opacity: 1 }}
        aria-hidden="true"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key={`spotlight-${payload.targetId}`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: "var(--z-overlay)",
          pointerEvents: "none",
          background: targetRect
            ? `radial-gradient(ellipse ${Math.max(targetRect.width + 40, 120)}px ${Math.max(targetRect.height + 40, 80)}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 50%, oklch(0 0 0 / 0.65) 100%)`
            : "oklch(0 0 0 / 0.5)",
        }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
      />

      {/* Card */}
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.97 }}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        key={`card-${payload.targetId}`}
        ref={cardRef}
        style={{
          position: "fixed",
          top: cardPosition.top,
          left: cardPosition.left,
          zIndex: "var(--z-tooltip)",
          width: 320,
          padding: "20px 20px 16px",
          borderRadius: 16,
          background: "oklch(0.12 0.02 260 / 0.94)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid oklch(1 0 0 / 0.1)",
          boxShadow:
            "0 8px 48px oklch(0.15 0.12 260 / 0.5), 0 0 1px oklch(1 0 0 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.06)",
        }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 28, mass: 0.7 }
        }
      >
        {/* Top glow edge */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            right: 16,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, oklch(0.7 0.18 260 / 0.5), transparent)",
            borderRadius: "1px 1px 0 0",
          }}
        />

        {/* Close button */}
        <button
          aria-label="Close tour"
          onClick={() => stopTour()}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid oklch(1 0 0 / 0.08)",
            background: "oklch(1 0 0 / 0.04)",
            color: "oklch(0.65 0.01 250)",
            cursor: "pointer",
            transition: "background 150ms ease, color 150ms ease",
          }}
          type="button"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        {/* Step indicator */}
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-data)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "oklch(0.65 0.15 260)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step {currentStepNumber} of {totalSteps}
        </span>

        {/* Title */}
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 16,
            fontWeight: 700,
            color: "oklch(0.95 0.01 250)",
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
          }}
        >
          {payload.title}
        </h3>

        {/* Content */}
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "oklch(0.7 0.01 250)",
          }}
        >
          {payload.content}
        </p>

        {/* Progress dots + navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Dots */}
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={`dot-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: static dot count
                  i
                }`}
                style={{
                  width: i + 1 === currentStepNumber ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i + 1 === currentStepNumber
                      ? "oklch(0.7 0.18 260)"
                      : "oklch(1 0 0 / 0.12)",
                  transition: "width 250ms ease, background 250ms ease",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {!isFirst && (
              <button
                aria-label="Previous step"
                onClick={() => previous()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  background: "oklch(1 0 0 / 0.04)",
                  color: "oklch(0.75 0.01 250)",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <button
              onClick={() => (isLast ? stopTour() : next())}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background:
                  "linear-gradient(135deg, oklch(0.55 0.2 260), oklch(0.45 0.22 280))",
                color: "oklch(0.97 0.01 260)",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: "pointer",
                boxShadow: "0 2px 8px oklch(0.3 0.15 260 / 0.4)",
                transition: "box-shadow 150ms ease, transform 150ms ease",
              }}
              type="button"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
