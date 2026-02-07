"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

interface GhostCardManagerContextValue {
  requestDefrost(cardId: string): boolean;
  reportFrosted(cardId: string): void;
}

const GhostCardManagerContext =
  createContext<GhostCardManagerContextValue | null>(null);

const MAX_CONCURRENT_DEFROSTS = 3;
const STAGGER_DELAY_MS = 100;

export function GhostCardManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const activeDefrostsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processQueue = useCallback(() => {
    if (
      activeDefrostsRef.current.size >= MAX_CONCURRENT_DEFROSTS ||
      queueRef.current.length === 0
    ) {
      return;
    }

    const cardId = queueRef.current.shift();
    if (cardId) {
      activeDefrostsRef.current.add(cardId);
    }
  }, []);

  const requestDefrost = useCallback((cardId: string): boolean => {
    // Already active
    if (activeDefrostsRef.current.has(cardId)) {
      return true;
    }

    if (activeDefrostsRef.current.size < MAX_CONCURRENT_DEFROSTS) {
      activeDefrostsRef.current.add(cardId);
      return true;
    }

    // Queue it
    if (!queueRef.current.includes(cardId)) {
      queueRef.current.push(cardId);
    }
    return false;
  }, []);

  const reportFrosted = useCallback(
    (cardId: string) => {
      activeDefrostsRef.current.delete(cardId);
      // Remove from queue if it was queued
      queueRef.current = queueRef.current.filter((id) => id !== cardId);

      // Schedule next dequeue with stagger
      if (queueRef.current.length > 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(processQueue, STAGGER_DELAY_MS);
      }
    },
    [processQueue]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value: GhostCardManagerContextValue = {
    requestDefrost,
    reportFrosted,
  };

  return (
    <GhostCardManagerContext.Provider value={value}>
      {children}
    </GhostCardManagerContext.Provider>
  );
}

export function useGhostCardManager(): GhostCardManagerContextValue {
  const ctx = useContext(GhostCardManagerContext);
  if (!ctx) {
    throw new Error(
      "useGhostCardManager must be used within GhostCardManagerProvider"
    );
  }
  return ctx;
}
