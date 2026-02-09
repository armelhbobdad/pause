import type { OnboardingStep } from "@onboardjs/react";

import type { TourStepPayload } from "./tour-step-card";
import { TourStepCard } from "./tour-step-card";

const COMPONENT_KEY = "tour-step";

function step(
  id: string,
  payload: TourStepPayload,
  nextStep?: string
): OnboardingStep {
  return {
    id,
    type: "CUSTOM_COMPONENT" as const,
    payload: { ...payload, componentKey: COMPONENT_KEY },
    component: TourStepCard,
    ...(nextStep ? { nextStep } : {}),
  };
}

export const tourSteps: OnboardingStep[] = [
  step(
    "demo-panel",
    {
      title: "Demo Panel",
      content:
        "Welcome! Switch between Rookie and Pro profiles to see different user states, or start this guided tour.",
      targetId: "tour-demo-panel",
      position: "right",
    },
    "card-vault"
  ),
  step(
    "card-vault",
    {
      title: "Card Vault",
      content:
        "Click a card to request an unlock and trigger the AI Guardian. The 3-tier system (Analyst, Negotiator, Therapist) activates based on risk score.",
      targetId: "tour-card-vault",
      position: "bottom",
    },
    "chat-bubble"
  ),
  step(
    "chat-bubble",
    {
      title: "AI Chat",
      content:
        'Ask questions about Pause. Try: "What are the three AI tiers?" The chat uses the ACE self-learning framework.',
      targetId: "tour-chat-bubble",
      position: "left",
    },
    "history"
  ),
  step(
    "history",
    {
      title: "Interaction History",
      content:
        "Every Guardian decision with risk scores, outcomes, and reasoning. Switch to Pro profile to see 6 rich interactions.",
      targetId: "tour-history",
      position: "top",
    },
    "savings"
  ),
  step(
    "savings",
    {
      title: "Savings Tracker",
      content:
        "Total savings from coupons and delays found by the Negotiator tier. Pro profile shows $53 in real savings.",
      targetId: "tour-savings",
      position: "top",
    },
    "ghost-cards"
  ),
  step("ghost-cards", {
    title: "Ghost Cards",
    content:
      "Past purchases resurface for reflection. Your feedback trains the AI \u2014 the ACE framework learns which strategies help you most.",
    targetId: "tour-ghost-cards",
    position: "top",
  }),
];
