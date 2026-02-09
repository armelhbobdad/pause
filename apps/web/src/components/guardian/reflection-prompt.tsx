import type { ReflectionPromptOutput } from "@/lib/guardian/types";

export interface ReflectionPromptProps {
  output: ReflectionPromptOutput;
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
        aria-label="Wait and reflect on this purchase"
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
        Wait & Reflect
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

export function ReflectionPrompt({
  output,
  onOverride,
  onWait,
  disabled,
}: ReflectionPromptProps) {
  return (
    <output
      aria-label="Reflection question"
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
          fontSize: "1rem",
          color: "var(--therapist-amber)",
          lineHeight: 1.6,
          fontWeight: 500,
          fontStyle: "italic",
        }}
      >
        {output.reflectionPrompt}
      </div>

      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "0.6875rem",
          color: "var(--therapist-amber)",
          marginTop: "0.5rem",
          opacity: 0.5,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        {output.strategyName}
      </div>

      <ActionButtons
        disabled={disabled}
        onOverride={onOverride}
        onWait={onWait}
      />
    </output>
  );
}
