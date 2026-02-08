"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Detects transition from 0 to 1+ interactions and triggers a celebration state.
 * The celebration lasts 500ms (matching the onboarding fade-out duration).
 *
 * @param interactionCount - Current number of user interactions
 * @returns Whether the celebration animation should be active
 */
export function useFirstInteractionCelebration(
  interactionCount: number
): boolean {
  const prevCountRef = useRef(interactionCount);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (prevCountRef.current === 0 && interactionCount > 0) {
      prevCountRef.current = interactionCount;
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = interactionCount;
  }, [interactionCount]);

  return celebrating;
}
