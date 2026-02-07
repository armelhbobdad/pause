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
  /** Called when IntersectionObserver triggers de-frost */
  onDefrost?: () => void;
  /** Called when user provides satisfaction feedback */
  onFeedback?: (decision: "positive" | "negative") => void;
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

function FeedbackButtons({
  tierOrigin,
  onFeedback,
}: {
  tierOrigin: string;
  onFeedback?: (decision: "positive" | "negative") => void;
}) {
  const labels = FEEDBACK_LABELS[tierOrigin];
  if (!labels) {
    return null;
  }

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
          cursor: "pointer",
        }}
        type="button"
      >
        {labels.positive}
      </button>
      <button
        aria-label={labels.negative}
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
          cursor: "pointer",
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
  onDefrost,
  onFeedback,
}: GhostCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isFrosted = state === "frosted";
  const isFeedbackGiven = state === "feedback_given";
  const showButtons = state === "revealed" && tierOrigin !== "override";

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

  // Sensitive category suppression
  if (isSensitive) {
    return null;
  }

  // Incomplete data suppression
  if (isIncomplete) {
    return null;
  }

  return (
    <article
      aria-label={`Past spending: ${recall}`}
      aria-live={isFeedbackGiven ? "polite" : undefined}
      data-ghost-id={id}
      ref={cardRef}
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
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
      {showButtons && (
        <FeedbackButtons onFeedback={onFeedback} tierOrigin={tierOrigin} />
      )}
    </article>
  );
}
