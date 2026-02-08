"use client";

import { Award, BarChart3 } from "lucide-react";
import Link from "next/link";

import { NativeBadge } from "@/components/uitripled/native-badge-carbon";
import { NativeButton } from "@/components/uitripled/native-button-shadcnui";

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex min-h-[100dvh] max-w-[1200px] flex-col items-center justify-center gap-8 px-4 py-12 text-center"
    >
      <h1
        className="max-w-[720px] font-bold leading-tight tracking-tight"
        id="hero-heading"
        style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}
      >
        Good Friction — AI that helps you pause before impulse purchases
      </h1>

      <div
        aria-label="Card vault preview showing a protected payment card"
        className="landing-card-breathe relative flex h-48 w-72 items-center justify-center overflow-hidden rounded-2xl sm:h-56 sm:w-80"
        role="img"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          animation:
            "card-breathe var(--pause-timing-breathe) ease-in-out infinite",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: "blur(var(--frost-blur))",
            WebkitBackdropFilter: "blur(var(--frost-blur))",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
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

      <div className="flex flex-wrap items-center justify-center gap-3">
        <NativeBadge size="sm" variant="glass">
          <Award className="mr-1 h-3 w-3" />
          Financial Health
        </NativeBadge>
        <NativeBadge size="sm" variant="glass">
          <BarChart3 className="mr-1 h-3 w-3" />
          Best Use of Opik
        </NativeBadge>
      </div>

      <div className="flex w-full flex-col items-center gap-3 sm:w-auto">
        <Link className="w-full sm:w-auto" href="/login">
          <NativeButton className="w-full sm:w-auto" glow>
            See Pause in Action (~45s)
          </NativeButton>
        </Link>
        <Link
          className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
          href="https://www.comet.com/opik"
          rel="noopener noreferrer"
          target="_blank"
        >
          or explore the AI traces
        </Link>
      </div>
    </section>
  );
}
