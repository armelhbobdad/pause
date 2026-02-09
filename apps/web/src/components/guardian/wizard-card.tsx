export interface WizardCardProps {
  reasoning: string;
  onExplore?: () => void;
  onSkip?: () => void;
  disabled?: boolean;
}

export function WizardCard({
  reasoning,
  onExplore,
  onSkip,
  disabled,
}: WizardCardProps) {
  return (
    <output
      aria-label="Wizard option"
      aria-live="polite"
      style={{
        display: "block",
        borderLeft: "4px solid var(--therapist-amber)",
        backgroundColor: "oklch(0.18 0.04 50 / 65%)",
        borderRadius: "0.5rem",
        padding: "1rem 1.125rem",
        maxHeight: "350px",
        overflowY: "auto",
        animation: "savings-ticket-enter 800ms var(--ease-out-expo) both",
        boxShadow:
          "0 1px 3px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.04)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "0.9375rem",
          color: "var(--therapist-amber)",
          lineHeight: 1.5,
        }}
      >
        {reasoning}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.75rem",
        }}
      >
        <button
          aria-label="Explore more with reflection wizard"
          disabled={disabled}
          onClick={onExplore}
          style={{
            flex: 1,
            minHeight: "44px",
            padding: "0.625rem 1rem",
            border: "none",
            borderRadius: "0.375rem",
            backgroundColor: "var(--therapist-amber)",
            color: "white",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Explore More
        </button>
        <button
          aria-label="Skip reflection wizard"
          disabled={disabled}
          onClick={onSkip}
          style={{
            flex: 1,
            minHeight: "44px",
            padding: "0.625rem 1rem",
            border: "2px solid var(--therapist-amber)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            color: "var(--therapist-amber)",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Skip
        </button>
      </div>
    </output>
  );
}
