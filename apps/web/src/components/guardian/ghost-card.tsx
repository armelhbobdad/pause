"use client";

import { useEffect, useRef } from "react";

export interface GhostCardProps {
  /** Unique ghost card ID */
  id: string;
  /** Card lifecycle state */
  state: "frosted" | "revealed" | "feedback_given";
  /** Conversational recall text */
  recall: string;
  /** Structured data: price + merchant + temporal context */
  data: string;
  /** Skillbook learning insight (optional) */
  learning?: string;
  /** Guardian tier that handled the original interaction */
  tierOrigin: "negotiator" | "therapist" | "override";
  /** Spending category for sensitive filtering */
  category?: string;
  /** Recorded satisfaction feedback value (null = not yet provided) */
  satisfactionFeedback: "worth_it" | "regret_it" | "not_sure" | null;
  /** Whether a feedback request is currently in flight */
  isSubmitting?: boolean;
  /** Called when IntersectionObserver triggers de-frost */
  onDefrost?: () => void;
  /** Called when user provides satisfaction feedback (legacy) */
  onFeedback?: (decision: "positive" | "negative" | "skip") => void;
  /** Called with DB-aligned satisfaction value for PATCH route, or null to clear (re-enter editing) */
  onSatisfactionFeedback?: (
    satisfaction: "worth_it" | "regret_it" | "not_sure" | null
  ) => void;
}

const SENSITIVE_CATEGORIES = ["alcohol", "gambling", "pharmacy"];

const FEEDBACK_LABELS: Record<
  string,
  { positive: string; negative: string } | null
> = {
  negotiator: { positive: "Worth it", negative: "Regret it" },
  therapist: { positive: "Good question", negative: "Not helpful" },
  override: null,
};

const SATISFACTION_MESSAGES: Record<string, string> = {
  worth_it: "You said: Worth it",
  regret_it: "Thanks for sharing. This helps your Guardian learn.",
  not_sure: "Got it. You can always change your mind later.",
};

function SatisfactionDisplay({
  satisfactionFeedback,
  onChangeFeedback,
}: {
  satisfactionFeedback: "worth_it" | "regret_it" | "not_sure";
  onChangeFeedback: () => void;
}) {
  const message = SATISFACTION_MESSAGES[satisfactionFeedback];

  return (
    <div
      aria-live="polite"
      style={{
        marginTop: "0.75rem",
        fontFamily: "var(--font-conversation)",
        fontSize: "0.875rem",
        color: "oklch(0.75 0.02 250)",
        lineHeight: 1.5,
      }}
    >
      <span>{message}</span>
      <button
        aria-label="Change satisfaction feedback"
        onClick={onChangeFeedback}
        style={{
          display: "inline-block",
          marginLeft: "0.5rem",
          padding: 0,
          border: "none",
          backgroundColor: "transparent",
          color: "oklch(0.7 0.06 250)",
          fontFamily: "var(--font-conversation)",
          fontSize: "0.8125rem",
          textDecoration: "underline",
          cursor: "pointer",
        }}
        type="button"
      >
        Change
      </button>
    </div>
  );
}

function FeedbackButtons({
  tierOrigin,
  isSubmitting,
  onFeedback,
}: {
  tierOrigin: string;
  isSubmitting?: boolean;
  onFeedback?: (decision: "positive" | "negative" | "skip") => void;
}) {
  const labels = FEEDBACK_LABELS[tierOrigin];
  if (!labels) {
    return null;
  }

  const disabled = !!isSubmitting;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.75rem",
      }}
    >
      <button
        aria-label={labels.positive}
        disabled={disabled}
        onClick={() => onFeedback?.("positive")}
        style={{
          flex: 1,
          minHeight: "48px",
          padding: "0.625rem 1rem",
          border: "2px solid var(--card-border)",
          borderRadius: "0.375rem",
          backgroundColor: "transparent",
          color: "oklch(0.85 0.02 250)",
          fontFamily: "var(--font-conversation)",
          fontWeight: "bold",
          fontSize: "0.875rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        type="button"
      >
        {labels.positive}
      </button>
      <button
        aria-label="Not sure"
        disabled={disabled}
        onClick={() => onFeedback?.("skip")}
        style={{
          flex: 1,
          minHeight: "48px",
          padding: "0.625rem 1rem",
          border: "2px solid var(--card-border)",
          borderRadius: "0.375rem",
          backgroundColor: "transparent",
          color: "oklch(0.75 0.02 250)",
          fontFamily: "var(--font-conversation)",
          fontWeight: "bold",
          fontSize: "0.875rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        type="button"
      >
        Not sure
      </button>
      <button
        aria-label={labels.negative}
        disabled={disabled}
        onClick={() => onFeedback?.("negative")}
        style={{
          flex: 1,
          minHeight: "48px",
          padding: "0.625rem 1rem",
          border: "2px solid var(--card-border)",
          borderRadius: "0.375rem",
          backgroundColor: "transparent",
          color: "oklch(0.65 0.02 250)",
          fontFamily: "var(--font-conversation)",
          fontWeight: "bold",
          fontSize: "0.875rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        type="button"
      >
        {labels.negative}
      </button>
    </div>
  );
}

function RevealedContent({
  recall,
  data,
  learning,
}: {
  recall: string;
  data: string;
  learning?: string;
}) {
  return (
    <>
      <div
        className="ghost-recall"
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "0.9375rem",
          color: "oklch(0.9 0.01 250)",
          lineHeight: 1.5,
        }}
      >
        {recall}
      </div>
      <div
        className="ghost-data"
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "0.8125rem",
          color: "oklch(0.7 0.02 250)",
          marginTop: "0.375rem",
          lineHeight: 1.4,
        }}
      >
        {data}
      </div>
      {learning && (
        <div
          className="ghost-learning"
          style={{
            fontFamily: "var(--font-conversation)",
            fontStyle: "italic",
            fontSize: "0.8125rem",
            color: "oklch(0.65 0.03 250)",
            marginTop: "0.5rem",
            lineHeight: 1.4,
          }}
        >
          {learning}
        </div>
      )}
    </>
  );
}

export function GhostCard({
  id,
  state,
  recall,
  data,
  learning,
  tierOrigin,
  category,
  satisfactionFeedback,
  isSubmitting,
  onDefrost,
  onFeedback,
  onSatisfactionFeedback,
}: GhostCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const feedbackContainerRef = useRef<HTMLDivElement>(null);

  const isFrosted = state === "frosted";
  const isFeedbackGiven = state === "feedback_given";
  const showButtons =
    state === "revealed" || (isFeedbackGiven && satisfactionFeedback === null);
  const showSatisfaction = isFeedbackGiven && satisfactionFeedback !== null;
  const hasButtons = showButtons && tierOrigin !== "override";

  // Suppression checks (computed before hooks, returned after)
  const isSensitive =
    !!category && SENSITIVE_CATEGORIES.includes(category.toLowerCase());
  const isIncomplete = !(recall && data);

  useEffect(() => {
    if (!isFrosted || isSensitive || isIncomplete || !cardRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onDefrost?.();
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    );
    observerRef.current.observe(cardRef.current);

    return () => observerRef.current?.disconnect();
  }, [isFrosted, isSensitive, isIncomplete, onDefrost]);

  // Focus management: after "Change" click restores buttons, focus first button
  useEffect(() => {
    if (hasButtons && feedbackContainerRef.current) {
      const firstButton = feedbackContainerRef.current.querySelector("button");
      firstButton?.focus();
    }
  }, [hasButtons]);

  // Sensitive category suppression
  if (isSensitive) {
    return null;
  }

  // Incomplete data suppression
  if (isIncomplete) {
    return null;
  }

  const handleFeedback = (decision: "positive" | "negative" | "skip") => {
    onFeedback?.(decision);
    const satisfactionMap = {
      positive: "worth_it",
      negative: "regret_it",
      skip: "not_sure",
    } as const;
    onSatisfactionFeedback?.(satisfactionMap[decision]);
  };

  const handleChangeFeedback = () => {
    // Signal parent to clear satisfactionFeedback and re-show buttons
    onSatisfactionFeedback?.(null);
  };

  const tierBorderColors: Record<string, string> = {
    negotiator: "var(--savings-gold)",
    therapist: "var(--therapist-amber)",
  };
  const tierBorderColor = tierBorderColors[tierOrigin] ?? "var(--card-border)";

  return (
    <article
      aria-label={`Past spending: ${recall}`}
      aria-live={isFeedbackGiven ? "polite" : undefined}
      className="glass-card"
      data-ghost-id={id}
      ref={cardRef}
      style={{
        borderLeft: `3px solid ${tierBorderColor}`,
        borderRadius: "0.5rem",
        padding: "1rem",
        filter: isFrosted ? "blur(var(--frost-blur))" : "blur(0px)",
        opacity: isFrosted ? 0.7 : 1,
        transition:
          "filter var(--duration-reveal) var(--ease-out-expo), opacity var(--duration-reveal) var(--ease-out-expo)",
        animation: isFeedbackGiven
          ? "ghost-feedback-flash 600ms ease-out"
          : undefined,
      }}
    >
      <RevealedContent data={data} learning={learning} recall={recall} />
      {hasButtons && (
        <div ref={feedbackContainerRef}>
          <FeedbackButtons
            isSubmitting={isSubmitting}
            onFeedback={handleFeedback}
            tierOrigin={tierOrigin}
          />
        </div>
      )}
      {showSatisfaction && (
        <SatisfactionDisplay
          onChangeFeedback={handleChangeFeedback}
          satisfactionFeedback={satisfactionFeedback}
        />
      )}
    </article>
  );
}
