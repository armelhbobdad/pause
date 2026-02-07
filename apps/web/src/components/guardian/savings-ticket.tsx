import type { BestOffer } from "@/lib/guardian/types";

export interface SavingsTicketProps {
  bestOffer: BestOffer | null;
  className?: string;
  onApply?: (bestOffer: BestOffer) => Promise<void>;
  isApplied?: boolean;
  isApplying?: boolean;
  onSkip?: () => Promise<void>;
  isSkipped?: boolean;
  isSkipping?: boolean;
  disabled?: boolean;
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

function Spinner({ borderColor }: { borderColor: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "1rem",
        height: "1rem",
        border: `2px solid ${borderColor}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}

interface ActionButtonsProps {
  bestOffer: BestOffer;
  onApply?: (bestOffer: BestOffer) => Promise<void>;
  isApplying?: boolean;
  onSkip?: () => Promise<void>;
  isSkipping?: boolean;
  disabled?: boolean;
}

function ActionButtons({
  bestOffer,
  onApply,
  isApplying,
  onSkip,
  isSkipping,
  disabled,
}: ActionButtonsProps) {
  const isDisabled = isApplying || isSkipping || disabled;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.75rem",
      }}
    >
      {onApply && (
        <button
          aria-label="Apply coupon and unlock card"
          disabled={isDisabled}
          onClick={() => onApply(bestOffer)}
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            minHeight: "44px",
            padding: "0.625rem 1rem",
            border: "none",
            borderRadius: "0.375rem",
            backgroundColor: "var(--savings-gold)",
            color: "white",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: isDisabled ? 0.6 : 1,
          }}
          type="button"
        >
          {isApplying ? (
            <>
              <Spinner borderColor="white" />
              Applying…
            </>
          ) : (
            "Apply & Unlock"
          )}
        </button>
      )}
      {onSkip && (
        <button
          aria-label="Skip savings and unlock card"
          disabled={isDisabled}
          onClick={() => onSkip()}
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            minHeight: "44px",
            padding: "0.625rem 1rem",
            border: "2px solid var(--savings-gold)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            color: "var(--savings-gold)",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: isDisabled ? 0.6 : 1,
          }}
          type="button"
        >
          {isSkipping ? (
            <>
              <Spinner borderColor="var(--savings-gold)" />
              Skipping…
            </>
          ) : (
            "No thanks"
          )}
        </button>
      )}
    </div>
  );
}

function StatusIndicator({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        width: "100%",
        marginTop: "0.75rem",
        padding: "0.625rem 1rem",
        color,
        fontWeight: "bold",
        fontSize: "0.875rem",
      }}
    >
      {text}
    </div>
  );
}

export function SavingsTicket({
  bestOffer,
  className,
  onApply,
  isApplied,
  isApplying,
  onSkip,
  isSkipped,
  isSkipping,
  disabled,
}: SavingsTicketProps) {
  if (!bestOffer) {
    return null;
  }

  const isPriceMatch = bestOffer.type === "price_match";
  const displayAmount = formatDisplayAmount(bestOffer);
  const ariaLabel = buildAriaLabel(bestOffer);
  const hasActions = onApply || onSkip;
  const showButtons = hasActions && !isApplied && !isSkipped;

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

      {showButtons && (
        <ActionButtons
          bestOffer={bestOffer}
          disabled={disabled}
          isApplying={isApplying}
          isSkipping={isSkipping}
          onApply={onApply}
          onSkip={onSkip}
        />
      )}

      {isApplied && (
        <StatusIndicator color="var(--savings-gold)" text="Applied ✓" />
      )}

      {!isApplied && isSkipped && (
        <StatusIndicator color="var(--text-secondary, #888)" text="Skipped" />
      )}
    </output>
  );
}
