"use client";

import Link from "next/link";

import { NativeButton } from "@/components/uitripled/native-button-shadcnui";

export function FirstRunState() {
  return (
    <div
      className="flex flex-col items-center gap-6 py-8 text-center"
      data-testid="first-run-state"
    >
      <div
        aria-label="Your protected card vault"
        className="landing-card-breathe flex h-48 w-72 items-center justify-center overflow-hidden rounded-2xl"
        role="img"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          animation:
            "card-breathe var(--pause-timing-breathe) ease-in-out infinite",
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className="font-mono text-lg tracking-widest"
            style={{ color: "var(--guardian-pulse-start)" }}
          >
            •••• •••• •••• 4242
          </div>
          <div
            className="text-xs"
            style={{ color: "var(--guardian-pulse-end)" }}
          >
            Protected
          </div>
        </div>
      </div>

      <p className="max-w-xs text-muted-foreground text-sm">
        Your card is protected. Tap to start your first Guardian flow.
      </p>

      <Link href="/dashboard?demo=true">
        <NativeButton variant="outline">See Pause in Action</NativeButton>
      </Link>
    </div>
  );
}
