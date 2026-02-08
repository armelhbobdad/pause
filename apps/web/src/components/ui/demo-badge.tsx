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
        top: 8,
        right: 8,
        zIndex: 50,
        padding: "2px 8px",
        borderRadius: 4,
        fontFamily: "var(--font-data)",
        fontSize: 11,
        lineHeight: "18px",
        background: "oklch(0.3 0.02 250 / 0.6)",
        color: "oklch(0.8 0.02 250)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      DEMO
    </output>
  );
}
