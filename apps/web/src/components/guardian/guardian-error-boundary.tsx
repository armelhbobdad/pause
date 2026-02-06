"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

// ============================================================================
// Types
// ============================================================================

interface GuardianErrorBoundaryProps {
  children: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface GuardianErrorBoundaryState {
  hasError: boolean;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

/**
 * GuardianErrorBoundary catches JavaScript errors in the Card Vault component
 * tree and displays a supportive fallback UI following the Bodyguard frame.
 *
 * This is the ONLY class component in the codebase — React's error boundary
 * API requires componentDidCatch/getDerivedStateFromError which are class-only.
 *
 * To reset the boundary on context changes (e.g., route navigation), change
 * the `key` prop from the parent: `<GuardianErrorBoundary key={resetKey}>`.
 * This unmounts/remounts the boundary, clearing any caught error state.
 *
 * @constraint AC#1: Catches render errors, shows fallback with retry
 * @constraint UX Frame: "Your Guardian hit a snag. Tap to retry." — never raw errors
 * @constraint a11y: role="alert" on fallback, auto-focus retry button
 */
export class GuardianErrorBoundary extends Component<
  GuardianErrorBoundaryProps,
  GuardianErrorBoundaryState
> {
  constructor(props: GuardianErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GuardianErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details to console for debugging (Opik trace logging deferred to Epic 3)
    console.error("[GuardianErrorBoundary]", error, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false });
  };

  // Ref callback: auto-focus retry button when it mounts (AC#1 a11y requirement)
  private readonly setRetryButtonRef = (
    node: HTMLButtonElement | null
  ): void => {
    node?.focus();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            background: "var(--guardian-error-bg, oklch(0.95 0.03 22))",
            borderRadius: "1rem",
            minHeight: "200px",
          }}
        >
          {/* Shield icon — Bodyguard visual */}
          <div
            aria-hidden="true"
            style={{
              fontSize: "2rem",
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            🛡️
          </div>

          <p
            style={{
              fontFamily: "var(--font-conversation)",
              color: "var(--muted-foreground)",
              margin: 0,
              fontSize: "0.95rem",
            }}
          >
            Your Guardian hit a snag. Tap to retry.
          </p>

          <button
            aria-label="Tap to retry"
            onClick={this.resetErrorBoundary}
            ref={this.setRetryButtonRef}
            style={{
              fontFamily: "var(--font-conversation)",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
            type="button"
          >
            Tap to retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
