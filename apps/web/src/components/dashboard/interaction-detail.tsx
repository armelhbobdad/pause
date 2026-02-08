"use client";

interface InteractionDetailProps {
  reasoningSummary: string | null;
  tier: string;
  outcome: string | null;
  savingsAmountCents: number | null;
  couponCode: string | null;
  satisfactionStatus?: string | null;
}

const STRATEGY_LABELS: Record<string, string> = {
  analyst: "Risk Analysis",
  negotiator: "Coupon Search",
  therapist: "Behavioral Strategy",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function InteractionDetail({
  reasoningSummary,
  tier,
  outcome,
  savingsAmountCents,
  couponCode,
  satisfactionStatus,
}: InteractionDetailProps) {
  const strategy = STRATEGY_LABELS[tier] ?? tier;
  const hasSavings = savingsAmountCents != null && savingsAmountCents > 0;

  return (
    <div
      className="flex flex-col gap-2 px-8 pb-3 text-sm"
      data-testid="interaction-detail"
      style={{
        animation: "breath-beat-enter var(--transition-expand) ease-out",
      }}
    >
      {/* Reasoning summary */}
      {reasoningSummary && (
        <p
          className="text-muted-foreground text-xs leading-relaxed"
          data-testid="detail-reasoning"
        >
          {reasoningSummary}
        </p>
      )}

      {/* Strategy used */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Strategy:</span>
        <span className="text-xs" data-testid="detail-strategy">
          {strategy}
        </span>
      </div>

      {/* Savings info (negotiator tier) */}
      {hasSavings && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Savings:</span>
          <span
            className="text-xs"
            data-testid="detail-savings"
            style={{
              color: "var(--savings-gold)",
              fontFamily: "var(--font-data)",
            }}
          >
            {currencyFormatter.format(savingsAmountCents / 100)}
          </span>
          {couponCode && (
            <code
              className="rounded bg-muted px-1.5 py-0.5 text-xs"
              data-testid="detail-coupon"
            >
              {couponCode}
            </code>
          )}
        </div>
      )}

      {/* Outcome */}
      {outcome && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Decision:</span>
          <span className="text-xs" data-testid="detail-outcome">
            {outcome}
          </span>
        </div>
      )}

      {/* Satisfaction feedback */}
      {satisfactionStatus && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Feedback:</span>
          <span className="text-xs" data-testid="detail-satisfaction">
            {satisfactionStatus}
          </span>
        </div>
      )}
    </div>
  );
}
