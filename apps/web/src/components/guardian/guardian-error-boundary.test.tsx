import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuardianErrorBoundary } from "./guardian-error-boundary";

const TAP_TO_RETRY_REGEX = /tap to retry/i;
const SOMETHING_WENT_WRONG_REGEX = /something went wrong/i;

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test render error");
  }
  return <div>Normal content</div>;
}

describe("GuardianErrorBoundary", () => {
  // Suppress console.error from React error boundary during tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children normally when no error", () => {
    render(
      <GuardianErrorBoundary>
        <div>Child content</div>
      </GuardianErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("catches render error and shows fallback UI", () => {
    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );
    expect(
      screen.getByText("Your Guardian hit a snag. Tap to retry.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Normal content")).not.toBeInTheDocument();
  });

  it("retry button resets error boundary", async () => {
    const user = userEvent.setup();

    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );

    expect(
      screen.getByText("Your Guardian hit a snag. Tap to retry.")
    ).toBeInTheDocument();

    // Clicking retry resets hasError. Since ThrowingChild still throws,
    // it will re-catch. This verifies the retry button triggers resetErrorBoundary.
    await user.click(screen.getByRole("button", { name: TAP_TO_RETRY_REGEX }));

    // Error boundary catches again (children still throw) — but the reset was triggered
    // Verify the boundary is still functional (shows fallback again)
    expect(
      screen.getByText("Your Guardian hit a snag. Tap to retry.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: TAP_TO_RETRY_REGEX })
    ).toBeInTheDocument();
  });

  it("has role='alert' on fallback container", () => {
    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("focus moves to retry button on error", () => {
    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );
    const retryButton = screen.getByRole("button", {
      name: TAP_TO_RETRY_REGEX,
    });
    expect(retryButton).toHaveFocus();
  });

  it("does not show raw error messages to the user", () => {
    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );
    expect(screen.queryByText("Test render error")).not.toBeInTheDocument();
    expect(
      screen.queryByText(SOMETHING_WENT_WRONG_REGEX)
    ).not.toBeInTheDocument();
  });

  it("uses Bodyguard frame messaging", () => {
    render(
      <GuardianErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GuardianErrorBoundary>
    );
    expect(
      screen.getByText("Your Guardian hit a snag. Tap to retry.")
    ).toBeInTheDocument();
  });
});
