"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  microCopy?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  microCopy,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col items-center gap-3 py-8 text-center",
        className
      )}
      data-testid="empty-state"
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full text-muted-foreground"
        style={{
          background:
            "radial-gradient(circle, oklch(0.25 0.02 250 / 60%), transparent 70%)",
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground text-sm">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
        {microCopy && (
          <p className="text-muted-foreground text-xs">{microCopy}</p>
        )}
      </div>
      {action && (
        <button
          className="mt-1 rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
