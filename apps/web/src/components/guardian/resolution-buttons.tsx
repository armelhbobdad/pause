"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

type ResolutionChoice = "wait" | "reveal" | "override";

export interface ResolutionButtonsProps {
  /** Whether the reflection has completed — triggers 500ms delay then show */
  reflectionComplete: boolean;
  /** Callback when Wait 24h is selected — dispatches RELOCK */
  onWait: () => void;
  /** Callback when Reveal Card is selected — dispatches REVEAL_APPROVED */
  onReveal: () => void;
  /** Callback when Override is selected — dispatches REVEAL_OVERRIDE */
  onOverride: () => void;
}

// ============================================================================
// ResolutionButtons Component
// ============================================================================

export function ResolutionButtons({
  reflectionComplete,
  onWait,
  onReveal,
  onOverride,
}: ResolutionButtonsProps) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<ResolutionChoice | null>(null);
  const waitButtonRef = useRef<HTMLButtonElement>(null);

  // 500ms delay after reflection completes before showing buttons
  useEffect(() => {
    if (!reflectionComplete) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [reflectionComplete]);

  // Auto-focus Wait button when visible
  useEffect(() => {
    if (visible && waitButtonRef.current) {
      waitButtonRef.current.focus();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  function handleSelect(choice: ResolutionChoice) {
    if (selected) {
      return;
    }
    setSelected(choice);

    switch (choice) {
      case "wait":
        onWait();
        break;
      case "reveal":
        onReveal();
        break;
      case "override":
        onOverride();
        break;
      default:
        break;
    }
  }

  function getButtonOpacity(choice: ResolutionChoice): number {
    if (!selected) {
      return 1;
    }
    return selected === choice ? 1 : 0.3;
  }

  function getButtonTransform(choice: ResolutionChoice): string | undefined {
    if (selected === choice) {
      return "scale(1.02)";
    }
    return undefined;
  }

  return (
    <fieldset
      aria-label="Choose how to resolve"
      data-testid="resolution-buttons"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        animation: "resolution-enter 400ms ease-out both",
        border: "none",
        padding: 0,
        margin: 0,
      }}
    >
      <style>{`
        @keyframes resolution-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes button-pulse {
          0%, 100% { transform: scale(1.02); }
          50% { transform: scale(1); }
        }
      `}</style>

      {/* Primary buttons row — responsive: inline on desktop, stacked on mobile */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          width: "100%",
          justifyContent: "center",
        }}
      >
        {/* Wait 24h — blue, the wise choice */}
        <button
          data-testid="resolution-wait"
          disabled={selected !== null && selected !== "wait"}
          onClick={() => handleSelect("wait")}
          ref={waitButtonRef}
          style={{
            flex: "1 1 auto",
            minWidth: "140px",
            minHeight: "48px",
            padding: "0.75rem 1.5rem",
            border: "2px solid var(--primary, hsl(var(--primary)))",
            borderRadius: "0.5rem",
            backgroundColor: "transparent",
            color: "var(--primary, hsl(var(--primary)))",
            fontWeight: "bold",
            fontSize: "0.9375rem",
            cursor: selected ? "default" : "pointer",
            opacity: getButtonOpacity("wait"),
            transform: getButtonTransform("wait"),
            transition: "opacity 300ms ease, transform 200ms ease",
            animation:
              selected === "wait"
                ? "button-pulse 600ms ease-in-out infinite"
                : undefined,
          }}
          type="button"
        >
          Wait 24 Hours
        </button>

        {/* Reveal Card — green, you earned this */}
        <button
          data-testid="resolution-reveal"
          disabled={selected !== null && selected !== "reveal"}
          onClick={() => handleSelect("reveal")}
          style={{
            flex: "1 1 auto",
            minWidth: "140px",
            minHeight: "48px",
            padding: "0.75rem 1.5rem",
            border: "none",
            borderRadius: "0.5rem",
            backgroundColor: "var(--pause-success)",
            color: "white",
            fontWeight: "bold",
            fontSize: "0.9375rem",
            cursor: selected ? "default" : "pointer",
            opacity: getButtonOpacity("reveal"),
            transform: getButtonTransform("reveal"),
            transition: "opacity 300ms ease, transform 200ms ease",
            boxShadow: "0 0 12px oklch(0.6 0.2 145 / 30%)",
            animation:
              selected === "reveal"
                ? "button-pulse 600ms ease-in-out infinite"
                : undefined,
          }}
          type="button"
        >
          Reveal My Card
        </button>
      </div>

      {/* Override — muted text link, physically separated */}
      <button
        data-testid="resolution-override"
        disabled={selected !== null && selected !== "override"}
        onClick={() => handleSelect("override")}
        style={{
          marginTop: "var(--space-4)",
          padding: "12px 16px",
          minHeight: "44px",
          border: "none",
          borderRadius: "0.25rem",
          backgroundColor: "transparent",
          color: "var(--muted-foreground, hsl(var(--muted-foreground)))",
          fontSize: "0.875rem",
          cursor: selected ? "default" : "pointer",
          opacity: getButtonOpacity("override"),
          transition: "opacity 300ms ease",
          textDecoration: "underline",
          animation:
            selected === "override"
              ? "button-pulse 600ms ease-in-out infinite"
              : undefined,
        }}
        type="button"
      >
        Override — use card now
      </button>
    </fieldset>
  );
}
