"use client";

import { useEffect, useRef, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCentsToDollars(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function useCountUp(target: number, duration = 500) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) {
      setValue(target);
      return;
    }
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out: 1 - (1 - t)^3
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(start + diff * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
    prevTarget.current = target;
  }, [target, duration]);

  return value;
}

interface SavingsCounterProps {
  totalCents: number;
}

export function SavingsCounter({ totalCents }: SavingsCounterProps) {
  const animatedCents = useCountUp(totalCents);
  const hasUpdated = useRef(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (totalCents > 0 && hasUpdated.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(timer);
    }
    if (totalCents > 0) {
      hasUpdated.current = true;
    }
  }, [totalCents]);

  return (
    <output
      aria-live="polite"
      className="flex items-baseline gap-1"
      data-testid="savings-counter"
    >
      <span
        className="font-bold text-2xl"
        data-testid="savings-counter-value"
        style={{
          fontFamily: "var(--font-data)",
          color: "var(--savings-gold)",
          transform: pulse ? "scale(1.05)" : "scale(1)",
          transition: "transform 300ms ease-out",
        }}
      >
        {formatCentsToDollars(animatedCents)}
      </span>
      <span className="text-muted-foreground text-sm">saved</span>
    </output>
  );
}
