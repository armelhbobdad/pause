import type { BestOffer } from "@/lib/guardian/types";

export interface SavingsTicketProps {
  bestOffer: BestOffer | null;
  className?: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats savings as a dollar amount (always -$X.XX) for aria-label use. */
function formatSavingsAmount(bestOffer: BestOffer): string {
  if (bestOffer.type === "percentage" && bestOffer.discountCents === 0) {
    return bestOffer.discount;
  }
  return `-${currencyFormatter.format(bestOffer.discountCents / 100)}`;
}

/** Formats the visual badge: "15% OFF" for percentage, "-$X.XX" for fixed/price_match. */
function formatDisplayAmount(bestOffer: BestOffer): string {
  if (bestOffer.type === "percentage") {
    return bestOffer.discount.toUpperCase();
  }
  return formatSavingsAmount(bestOffer);
}

function formatExpirationDate(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildAriaLabel(bestOffer: BestOffer): string {
  const amount = formatSavingsAmount(bestOffer);
  if (bestOffer.type === "price_match") {
    return `Savings found: ${amount} price match from ${bestOffer.source}`;
  }
  return `Savings found: ${amount} with code ${bestOffer.code}`;
}

export function SavingsTicket({ bestOffer, className }: SavingsTicketProps) {
  if (!bestOffer) {
    return null;
  }

  const isPriceMatch = bestOffer.type === "price_match";
  const displayAmount = formatDisplayAmount(bestOffer);
  const ariaLabel = buildAriaLabel(bestOffer);

  return (
    <output
      aria-label={ariaLabel}
      aria-live="assertive"
      className={["savings-ticket", className].filter(Boolean).join(" ")}
      style={{
        display: "block",
        borderLeft: "4px solid var(--savings-gold)",
        backgroundColor: "var(--savings-gold-subtle)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        boxShadow:
          "0 1px 3px oklch(0 0 0 / 0.1), 0 1px 2px oklch(0 0 0 / 0.06)",
        animation: "savings-ticket-enter 800ms var(--ease-out-expo) both",
      }}
    >
      <div
        className="savings-ticket-amount"
        style={{
          fontFamily: "var(--font-data)",
          fontWeight: "bold",
          fontSize: "1.5rem",
          color: "var(--savings-gold)",
          lineHeight: 1.2,
        }}
      >
        {displayAmount}
      </div>

      {!isPriceMatch && (
        <div
          className="savings-ticket-code"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "0.875rem",
            marginTop: "0.25rem",
            opacity: 0.85,
          }}
        >
          Code: {bestOffer.code}
        </div>
      )}

      <div
        className="savings-ticket-meta"
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "0.75rem",
          marginTop: "0.25rem",
          opacity: 0.65,
        }}
      >
        {isPriceMatch ? "Price match found" : "Coupon found"} via{" "}
        {bestOffer.source}
        {bestOffer.expiresAt && (
          <span>
            {" "}
            &middot; Expires {formatExpirationDate(bestOffer.expiresAt)}
          </span>
        )}
      </div>
    </output>
  );
}
