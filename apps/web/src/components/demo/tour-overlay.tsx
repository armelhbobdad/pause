"use client";

import { useOnboarding } from "@onboardjs/react";

/**
 * Renders the current tour step via OnboardJS engine.
 * Must be mounted inside <TourProvider>.
 * Returns null when no step is active (tour not started or completed).
 */
export function TourOverlay() {
  const { currentStep, renderStep, isCompleted } = useOnboarding();

  if (!currentStep || isCompleted) {
    return null;
  }

  return <>{renderStep()}</>;
}
