"use client";

export function DemoBadge() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return null;
  }

  return (
    <output
      aria-label="Demo mode active"
      style={{
        position: "fixed",
        bottom: 16,
        left: 60,
        zIndex: 50,
        padding: "5px 14px",
        borderRadius: 8,
        fontFamily: "var(--font-data)",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: "20px",
        background: "oklch(0.40 0.18 260 / 0.9)",
        color: "oklch(0.95 0.01 260)",
        border: "1px solid oklch(0.55 0.18 260 / 0.6)",
        boxShadow: "0 2px 8px oklch(0.3 0.15 260 / 0.4)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      DEMO
    </output>
  );
}
