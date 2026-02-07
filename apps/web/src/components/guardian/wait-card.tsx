import type { WaitOptionOutput } from "@/lib/guardian/types";

export interface WaitCardProps {
  output: WaitOptionOutput;
  onOverride?: () => void;
  onWait?: () => void;
  disabled?: boolean;
}

function ActionButtons({
  onOverride,
  onWait,
  disabled,
}: {
  onOverride?: () => void;
  onWait?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.75rem",
      }}
    >
      <button
        aria-label="Sleep on this purchase decision"
        disabled={disabled}
        onClick={onWait}
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
        Sleep on it
      </button>
      <button
        aria-label="Unlock card anyway"
        disabled={disabled}
        onClick={onOverride}
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
        Unlock Anyway
      </button>
    </div>
  );
}

export function WaitCard({
  output,
  onOverride,
  onWait,
  disabled,
}: WaitCardProps) {
  return (
    <output
      aria-label="Wait option"
      aria-live="polite"
      style={{
        display: "block",
        backgroundColor: "var(--therapist-amber-subtle)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        maxHeight: "350px",
        overflowY: "auto",
        animation: "savings-ticket-enter 800ms var(--ease-out-expo) both",
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
        {output.reasoning}
      </div>

      <ActionButtons
        disabled={disabled}
        onOverride={onOverride}
        onWait={onWait}
      />
    </output>
  );
}
