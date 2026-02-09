"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GuardianState } from "@/hooks/use-guardian-state";

const DRAFT_KEY = "pause-chat-draft";

interface UseChatSuppressionOptions {
  guardianState: GuardianState;
  isChatOpen: boolean;
  closeChat: () => void;
  getDraft: () => string;
}

interface UseChatSuppressionReturn {
  restoreDraft: () => string;
  clearDraft: () => void;
}

function saveDraft(draft: string): void {
  try {
    if (draft) {
      sessionStorage.setItem(DRAFT_KEY, draft);
    }
  } catch {
    /* storage unavailable */
  }
}

function loadDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function removeDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function useChatSuppression({
  guardianState,
  isChatOpen,
  closeChat,
  getDraft,
}: UseChatSuppressionOptions): UseChatSuppressionReturn {
  const prevState = useRef(guardianState);

  useEffect(() => {
    const wasIdle = prevState.current === "idle";
    const isExpanding = guardianState === "expanding";

    if (wasIdle && isExpanding && isChatOpen) {
      const draft = getDraft();
      saveDraft(draft);
      closeChat();
    }

    prevState.current = guardianState;
  }, [guardianState, isChatOpen, closeChat, getDraft]);

  const restoreDraft = useCallback((): string => {
    const draft = loadDraft();
    removeDraft();
    return draft;
  }, []);

  const clearDraft = useCallback((): void => {
    removeDraft();
  }, []);

  return { restoreDraft, clearDraft };
}
