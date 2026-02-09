"use client";

import { useEffect, useRef } from "react";
import type { GuardianState } from "@/hooks/use-guardian-state";

const FOCUSED_STATES: ReadonlySet<GuardianState> = new Set([
  "expanding",
  "active",
  "collapsing",
  "revealed",
]);

interface UseBrowserBackProtectionOptions {
  guardianState: GuardianState;
  onBlocked?: () => void;
}

export function useBrowserBackProtection({
  guardianState,
  onBlocked,
}: UseBrowserBackProtectionOptions): void {
  const hasPushed = useRef(false);
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  const isFocused = FOCUSED_STATES.has(guardianState);

  useEffect(() => {
    if (isFocused && !hasPushed.current) {
      window.history.pushState({ guardian: true }, "");
      hasPushed.current = true;
    }

    if (!isFocused && hasPushed.current) {
      window.history.back();
      hasPushed.current = false;
    }
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    function handlePopState(_event: PopStateEvent) {
      window.history.pushState({ guardian: true }, "");
      onBlockedRef.current?.();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isFocused]);
}
