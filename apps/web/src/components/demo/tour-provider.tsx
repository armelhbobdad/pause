"use client";

import { OnboardingProvider } from "@onboardjs/react";
import { createContext, useCallback, useContext, useState } from "react";

import { TourOverlay } from "./tour-overlay";
import { tourSteps } from "./tour-steps";

interface TourContextValue {
  tourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  tourActive: false,
  startTour: () => {
    /* noop */
  },
  stopTour: () => {
    /* noop */
  },
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tourActive, setTourActive] = useState(false);

  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setTourActive(false);
  }, []);

  return (
    <TourContext.Provider value={{ tourActive, startTour, stopTour }}>
      {children}
      {tourActive && (
        <OnboardingProvider steps={tourSteps}>
          <TourOverlay />
        </OnboardingProvider>
      )}
    </TourContext.Provider>
  );
}
