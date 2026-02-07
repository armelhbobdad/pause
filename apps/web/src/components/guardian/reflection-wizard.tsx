import { useEffect, useRef, useState } from "react";
import type { WizardResponse } from "@/lib/guardian/types";

// ============================================================================
// Static wizard steps (CBT-inspired, per epic stories AC)
// ============================================================================

const WIZARD_STEPS = [
  {
    step: 1,
    label: "Trigger",
    question: "What prompted this purchase desire?",
    inputType: "free-text" as const,
  },
  {
    step: 2,
    label: "Feeling",
    question: "How are you feeling right now?",
    inputType: "quick-select" as const,
    options: ["Excited", "Stressed", "Bored", "Restless"],
  },
  {
    step: 3,
    label: "Alternative",
    question: "What else could address that feeling?",
    inputType: "free-text" as const,
  },
] as const;

const TOTAL_STEPS = WIZARD_STEPS.length;

// ============================================================================
// Sub-components (extracted to manage cognitive complexity)
// ============================================================================

interface ProgressIndicatorProps {
  currentStep: number;
}

function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.75rem",
      }}
    >
      <span
        style={{
          fontSize: "0.8125rem",
          color: "var(--therapist-amber)",
          fontWeight: "bold",
        }}
      >
        Step {currentStep} of {TOTAL_STEPS}
      </span>
      <div
        aria-label="Wizard progress"
        aria-valuemax={TOTAL_STEPS}
        aria-valuemin={1}
        aria-valuenow={currentStep}
        role="progressbar"
        style={{ display: "flex", gap: "0.25rem" }}
      >
        {WIZARD_STEPS.map((s) => (
          <span
            key={s.step}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor:
                s.step <= currentStep
                  ? "var(--therapist-amber)"
                  : "var(--therapist-amber-subtle)",
              border: "1px solid var(--therapist-amber)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface FreeTextStepProps {
  stepNumber: number;
  question: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

function FreeTextStep({
  stepNumber,
  question,
  value,
  onChange,
  inputRef,
}: FreeTextStepProps) {
  const inputId = `wizard-free-text-step-${stepNumber}`;
  return (
    <div>
      <label
        htmlFor={inputId}
        style={{
          display: "block",
          fontFamily: "var(--font-conversation)",
          fontSize: "1rem",
          color: "var(--therapist-amber)",
          lineHeight: 1.5,
          marginBottom: "0.5rem",
        }}
      >
        {question}
      </label>
      <textarea
        aria-label={question}
        id={inputId}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        ref={inputRef}
        rows={3}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: "0.375rem",
          border: "1px solid var(--therapist-amber)",
          backgroundColor: "transparent",
          color: "inherit",
          fontFamily: "var(--font-conversation)",
          fontSize: "0.875rem",
          resize: "vertical",
        }}
        value={value}
      />
      <div
        style={{
          textAlign: "right",
          fontSize: "0.75rem",
          opacity: 0.6,
          marginTop: "0.25rem",
        }}
      >
        {value.length}/500
      </div>
    </div>
  );
}

interface QuickSelectStepProps {
  question: string;
  options: readonly string[];
  selected: string;
  otherText: string;
  onSelect: (value: string) => void;
  onOtherTextChange: (value: string) => void;
}

function QuickSelectStep({
  question,
  options,
  selected,
  otherText,
  onSelect,
  onOtherTextChange,
}: QuickSelectStepProps) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <legend
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "1rem",
          color: "var(--therapist-amber)",
          lineHeight: 1.5,
          marginBottom: "0.5rem",
        }}
      >
        {question}
      </legend>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        {options.map((option) => (
          <label
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            <input
              aria-label={option}
              checked={selected === option}
              name="feeling"
              onChange={() => onSelect(option)}
              type="radio"
            />
            {option}
          </label>
        ))}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          <input
            aria-label="Other"
            checked={selected === "Other"}
            name="feeling"
            onChange={() => onSelect("Other")}
            type="radio"
          />
          Other
        </label>
      </div>
      {selected === "Other" && (
        <input
          aria-label="Other feeling"
          maxLength={500}
          onChange={(e) => onOtherTextChange(e.target.value)}
          placeholder="Describe your feeling..."
          style={{
            width: "100%",
            marginTop: "0.5rem",
            padding: "0.5rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--therapist-amber)",
            backgroundColor: "transparent",
            color: "inherit",
            fontFamily: "var(--font-conversation)",
            fontSize: "0.875rem",
          }}
          type="text"
          value={otherText}
        />
      )}
    </fieldset>
  );
}

interface WizardSummaryProps {
  responses: WizardResponse[];
  onWait: () => void;
  onOverride: () => void;
  onBookmark: () => void;
  disabled?: boolean;
}

function WizardSummary({
  responses,
  onWait,
  onOverride,
  onBookmark,
  disabled,
}: WizardSummaryProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "1rem",
          color: "var(--therapist-amber)",
          fontWeight: "bold",
          marginBottom: "0.75rem",
        }}
      >
        Here&apos;s what you shared
      </div>
      {responses.map((r) => (
        <div
          key={r.step}
          style={{
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: "bold", color: "var(--therapist-amber)" }}>
            {WIZARD_STEPS[r.step - 1]?.label}:
          </span>{" "}
          {r.answer}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginTop: "0.75rem",
        }}
      >
        <button
          aria-label="Wait and reflect on this purchase"
          disabled={disabled}
          onClick={onWait}
          style={{
            flex: 1,
            minHeight: "44px",
            minWidth: "120px",
            padding: "0.625rem 1rem",
            border: "none",
            borderRadius: "0.375rem",
            backgroundColor: "var(--therapist-amber)",
            color: "white",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Wait & Reflect
        </button>
        <button
          aria-label="Unlock card anyway"
          disabled={disabled}
          onClick={onOverride}
          style={{
            flex: 1,
            minHeight: "44px",
            minWidth: "120px",
            padding: "0.625rem 1rem",
            border: "2px solid var(--therapist-amber)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            color: "var(--therapist-amber)",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Unlock Anyway
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "0.5rem",
        }}
      >
        <button
          aria-label="Bookmark reflection for later"
          disabled={disabled}
          onClick={onBookmark}
          style={{
            minHeight: "44px",
            padding: "0.625rem 1.5rem",
            border: "1px solid var(--therapist-amber)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            color: "var(--therapist-amber)",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Bookmark
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ReflectionWizard
// ============================================================================

export interface ReflectionWizardProps {
  onComplete: (
    responses: WizardResponse[],
    outcome: "wait" | "override" | "wizard_bookmark"
  ) => void;
  onAbandon: (lastCompletedStep: number) => void;
  disabled?: boolean;
}

export function ReflectionWizard({
  onComplete,
  onAbandon,
  disabled,
}: ReflectionWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [step2Selected, setStep2Selected] = useState("");
  const [step2OtherText, setStep2OtherText] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stepContainerRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus to the current step's first input on transitions (AC#18)
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentStep triggers re-focus on step change
  useEffect(() => {
    if (showSummary) {
      return;
    }
    const container = stepContainerRef.current;
    if (!container) {
      return;
    }
    const focusable = container.querySelector<HTMLElement>(
      "textarea, input, [tabindex]"
    );
    focusable?.focus();
  }, [currentStep, showSummary]);

  const buildResponses = (): WizardResponse[] =>
    WIZARD_STEPS.map((s, i) => ({
      step: s.step,
      question: s.question,
      answer: answers[i] ?? "",
    }));

  const handleNext = () => {
    if (currentStep === 2) {
      // For Step 2, resolve the answer from selection
      const answer =
        step2Selected === "Other" ? step2OtherText || "Other" : step2Selected;
      setAnswers((prev) => {
        const next = [...prev];
        next[1] = answer;
        return next;
      });
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handleTextChange = (value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentStep - 1] = value;
      return next;
    });
  };

  const handleComplete = (outcome: "wait" | "override" | "wizard_bookmark") => {
    // Ensure Step 2 answer is resolved before building responses
    const finalAnswers = [...answers];
    if (step2Selected === "Other") {
      finalAnswers[1] = step2OtherText || "Other";
    } else if (step2Selected) {
      finalAnswers[1] = step2Selected;
    }

    const responses = WIZARD_STEPS.map((s, i) => ({
      step: s.step,
      question: s.question,
      answer: finalAnswers[i] ?? "",
    }));

    onComplete(responses, outcome);
  };

  if (showSummary) {
    return (
      <fieldset
        aria-label="Reflection wizard"
        style={{
          border: "none",
          margin: 0,
          backgroundColor: "var(--therapist-amber-subtle)",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          maxHeight: "350px",
          overflowY: "auto",
        }}
      >
        <WizardSummary
          disabled={disabled}
          onBookmark={() => handleComplete("wizard_bookmark")}
          onOverride={() => handleComplete("override")}
          onWait={() => handleComplete("wait")}
          responses={buildResponses()}
        />
      </fieldset>
    );
  }

  const step = WIZARD_STEPS[currentStep - 1];

  return (
    <fieldset
      aria-label="Reflection wizard"
      style={{
        border: "none",
        margin: 0,
        backgroundColor: "var(--therapist-amber-subtle)",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        maxHeight: "350px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <ProgressIndicator currentStep={currentStep} />
        <button
          aria-label="Close wizard"
          onClick={() => onAbandon(currentStep - 1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
            padding: "0.25rem",
            opacity: 0.6,
          }}
          type="button"
        >
          &times;
        </button>
      </div>

      <div aria-live="polite" ref={stepContainerRef}>
        {step.inputType === "free-text" ? (
          <FreeTextStep
            inputRef={inputRef}
            onChange={handleTextChange}
            question={step.question}
            stepNumber={currentStep}
            value={answers[currentStep - 1] ?? ""}
          />
        ) : (
          <QuickSelectStep
            onOtherTextChange={setStep2OtherText}
            onSelect={setStep2Selected}
            options={step.options}
            otherText={step2OtherText}
            question={step.question}
            selected={step2Selected}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "0.75rem",
        }}
      >
        <button
          aria-label="Next step"
          disabled={disabled}
          onClick={handleNext}
          style={{
            minHeight: "44px",
            padding: "0.625rem 1.5rem",
            border: "none",
            borderRadius: "0.375rem",
            backgroundColor: "var(--therapist-amber)",
            color: "white",
            fontWeight: "bold",
            fontSize: "0.875rem",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </fieldset>
  );
}
