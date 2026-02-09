"use client";

import { useCallback, useState } from "react";

const DISMISSED_KEY = "pause:referral-dismissed";

interface ReferralCardProps {
  consecutiveOverrides: number;
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  } catch {
    /* noop: localStorage unavailable */
  }
}

export function ReferralCard({ consecutiveOverrides }: ReferralCardProps) {
  const [dismissed, setDismissedState] = useState(() => isDismissed());

  const handleDismiss = useCallback(() => {
    setDismissed();
    setDismissedState(true);
  }, []);

  if (dismissed || consecutiveOverrides < 1) {
    return null;
  }

  return (
    <div
      className="glass-card"
      data-testid="referral-card"
      style={{
        color: "var(--text-secondary)",
        borderRadius: "12px",
        padding: "16px",
        position: "relative",
      }}
    >
      <button
        aria-label="Dismiss"
        data-testid="referral-dismiss"
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: "18px",
          lineHeight: 1,
          padding: "4px",
        }}
        type="button"
      >
        &times;
      </button>

      <h3
        style={{
          margin: "0 0 4px 0",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        Resources that might help
      </h3>

      <p
        style={{
          margin: "0 0 12px 0",
          fontSize: "14px",
          opacity: 0.85,
        }}
      >
        Some people find these helpful when managing spending habits
      </p>

      <ul
        style={{
          margin: 0,
          padding: "0 0 0 20px",
          fontSize: "14px",
          listStyleType: "disc",
        }}
      >
        <li style={{ marginBottom: "6px" }}>
          <a
            href="https://www.nfcc.org"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
            target="_blank"
          >
            National Foundation for Credit Counseling
          </a>
        </li>
        <li>
          <a
            href="https://www.consumerfinance.gov/consumer-tools/money-as-you-grow/"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
            target="_blank"
          >
            Financial wellness resources
          </a>
        </li>
      </ul>
    </div>
  );
}
