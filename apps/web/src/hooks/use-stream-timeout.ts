"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseStreamTimeoutOptions {
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Timestamp (ms) of last received chunk activity */
  lastActivityTimestamp: number;
  /** Timeout in ms before declaring interruption (default: 3000ms per UX-84) */
  timeoutMs?: number;
}

export interface UseStreamTimeoutReturn {
  /** Whether the stream has been interrupted (no activity for timeoutMs) */
  isInterrupted: boolean;
  /**
   * Partial content received before interruption (null if not interrupted).
   * STUB: Always returns null until Epic 3 (Story 3.1) wires useChat streaming
   * content. When wired, this will preserve the partial response text visible
   * in the conversation area per AC#3.
   */
  partialContent: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default stream interruption timeout per UX-84: 3s after last chunk */
const DEFAULT_STREAM_TIMEOUT_MS = 3000;

// ============================================================================
// Hook
// ============================================================================

/**
 * useStreamTimeout — monitors streaming activity and detects interruptions.
 *
 * When streaming is active and no new tokens arrive within timeoutMs,
 * sets isInterrupted to true. Resets when new activity occurs.
 *
 * NOTE: useChat does not exist yet (Epic 3). This hook provides the interface
 * contract. Wire isStreaming and lastActivityTimestamp to mock/placeholder
 * values for now. The actual streaming integration happens in Story 3.1.
 *
 * @constraint AC#3: 3-second timeout after last received chunk
 * @constraint UX-84: Partial response preserved, status morphs to "Connection lost."
 */
export function useStreamTimeout({
  isStreaming,
  lastActivityTimestamp,
  timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
}: UseStreamTimeoutOptions): UseStreamTimeoutReturn {
  const [isInterrupted, setIsInterrupted] = useState(false);
  // Stub: always null until Epic 3 (Story 3.1) wires useChat streaming content.
  // Convert to useState when partial response preservation is implemented per AC#3.
  const partialContent: string | null = null;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track streaming state and detect interruptions
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastActivityTimestamp is intentionally in deps to reset the timeout watchdog on new streaming activity, even though it's not read inside the effect
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only monitor when actively streaming
    if (!isStreaming) {
      return;
    }

    // New activity arrives — reset interrupted state
    setIsInterrupted(false);

    // Start timeout watchdog
    timeoutRef.current = setTimeout(() => {
      setIsInterrupted(true);
    }, timeoutMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isStreaming, lastActivityTimestamp, timeoutMs]);

  return { isInterrupted, partialContent };
}
