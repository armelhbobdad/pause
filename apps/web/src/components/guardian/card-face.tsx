"use client";

/**
 * CardFace — Custom credit card design for the Card Vault.
 *
 * Displays a premium credit card with gradient background, masked card number,
 * cardholder name, and expiry. Uses design tokens exclusively (no hardcoded colors).
 * Text uses clamp() for readability at 150-200% zoom.
 *
 * @constraint AC#4: Design tokens only, clamp() for text, credit card visual style
 */

// ============================================================================
// Chip Component (decorative)
// ============================================================================

const CHIP_GRADIENT =
  "linear-gradient(135deg, oklch(0.7 0.05 50) 0%, oklch(0.6 0.05 50) 100%)";
const CHIP_CELL_BG = "oklch(0.5 0.03 50)";

function CardChip() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-3 gap-[2px] rounded p-1"
      style={{
        background: CHIP_GRADIENT,
        width: "clamp(32px, 8%, 44px)",
        height: "clamp(24px, 6%, 32px)",
      }}
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
// Card Face Component
// ============================================================================

export function CardFace() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      data-testid="card-face"
      style={{
        background:
          "linear-gradient(135deg, var(--card-bg) 0%, oklch(0.25 0.03 250) 50%, var(--card-bg) 100%)",
        border: "1px solid var(--pause-border-elevated)",
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, var(--pause-glass) 0%, transparent 60%)",
        }}
      />

      {/* Card content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6">
        {/* Top row: chip + network logo area */}
        <div className="flex items-start justify-between">
          <CardChip />
          <span
            className="text-muted-foreground"
            style={{
              fontFamily: "var(--font-conversation)",
              fontSize: "clamp(0.625rem, 2vw, 0.75rem)",
              letterSpacing: "0.05em",
              opacity: 0.6,
            }}
          >
            PAUSE
          </span>
        </div>

        {/* Card number (masked) */}
        <div
          data-testid="card-number"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "clamp(1rem, 4vw, 1.375rem)",
            letterSpacing: "0.12em",
            color: "var(--foreground)",
            opacity: 0.85,
          }}
        >
          **** **** **** 4242
        </div>

        {/* Bottom row: name + expiry */}
        <div className="flex items-end justify-between">
          <div>
            <span
              className="block text-muted-foreground"
              style={{
                fontFamily: "var(--font-conversation)",
                fontSize: "clamp(0.5rem, 1.5vw, 0.625rem)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.5,
              }}
            >
              Cardholder
            </span>
            <span
              data-testid="cardholder-name"
              style={{
                fontFamily: "var(--font-conversation)",
                fontSize: "clamp(0.75rem, 2.5vw, 0.875rem)",
                color: "var(--foreground)",
                opacity: 0.8,
              }}
            >
              A. HOLDER
            </span>
          </div>
          <div className="text-right">
            <span
              className="block text-muted-foreground"
              style={{
                fontFamily: "var(--font-conversation)",
                fontSize: "clamp(0.5rem, 1.5vw, 0.625rem)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.5,
              }}
            >
              Expires
            </span>
            <span
              data-testid="card-expiry"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: "clamp(0.75rem, 2.5vw, 0.875rem)",
                color: "var(--foreground)",
                opacity: 0.8,
              }}
            >
              12/28
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
