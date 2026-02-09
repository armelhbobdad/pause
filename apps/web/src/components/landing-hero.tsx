"use client";

import type { Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import { Award, BarChart3, Brain, Shield, Zap } from "lucide-react";
import Link from "next/link";

import { NativeBadge } from "@/components/uitripled/native-badge-carbon";
import { NativeButton } from "@/components/uitripled/native-button-shadcnui";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const features = [
  { icon: Zap, label: "Real-time analysis (< 3s)" },
  { icon: Brain, label: "Self-learning AI (ACE Framework)" },
  { icon: BarChart3, label: "Full observability (Opik traces)" },
] as const;

export function LandingHero() {
  const shouldReduceMotion = useReducedMotion();
  const animate = shouldReduceMotion ? undefined : "visible";
  const initial = shouldReduceMotion ? undefined : "hidden";

  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex min-h-[100dvh] max-w-[1200px] flex-col items-center justify-center gap-8 px-4 py-12 text-center"
    >
      <motion.div
        animate={animate}
        className="flex flex-col items-center gap-8"
        initial={initial}
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium text-xs"
            style={{
              background: "oklch(0.18 0.02 250 / 60%)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "var(--accent-glow)",
            }}
          >
            <Shield className="h-3.5 w-3.5" />
            AI-Powered Financial Guardian
          </span>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h1
            className="max-w-[720px] font-bold leading-tight tracking-tight"
            id="hero-heading"
            style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}
          >
            <span className="text-gradient-hero">Good Friction</span> — AI that
            helps you pause before impulse purchases
          </h1>
        </motion.div>

        <motion.div variants={itemVariants}>
          <p
            className="max-w-[540px] text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Your AI Guardian analyzes every purchase in real-time, learns your
            spending patterns, and creates just enough friction to save you from
            regret.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div
            aria-label="Card vault preview showing a protected payment card"
            className="landing-card-breathe relative flex h-48 w-72 items-center justify-center overflow-hidden rounded-2xl sm:h-56 sm:w-80"
            role="img"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              animation:
                "card-breathe var(--pause-timing-breathe) ease-in-out infinite",
              boxShadow: "0 0 40px oklch(0.75 0.15 250 / 0.1)",
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
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          variants={itemVariants}
        >
          <NativeBadge size="sm" variant="glass">
            <Award className="mr-1 h-3 w-3" />
            Financial Health
          </NativeBadge>
          <NativeBadge size="sm" variant="glass">
            <BarChart3 className="mr-1 h-3 w-3" />
            Best Use of Opik
          </NativeBadge>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          variants={itemVariants}
        >
          {features.map((feature) => (
            <div
              className="stat-card flex items-center gap-3 text-left"
              key={feature.label}
            >
              <feature.icon
                className="h-5 w-5 shrink-0"
                style={{ color: "var(--accent-glow)" }}
              />
              <span
                className="font-medium text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.div
          className="flex w-full flex-col items-center gap-3 sm:w-auto"
          variants={itemVariants}
        >
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
        </motion.div>
      </motion.div>
    </section>
  );
}
