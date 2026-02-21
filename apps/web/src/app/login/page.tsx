"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { NativeFlipText } from "@/components/uitripled/native-flip-text-carbon";
import { authClient } from "@/lib/auth-client";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [showSignIn, setShowSignIn] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setDemoError("");
    await authClient.signIn.email(
      { email: "alex@demo.pause.app", password: "demopass1" },
      {
        onSuccess: async () => {
          // Always seed Pro profile so dashboard shows rich data
          try {
            const res = await fetch("/api/demo/switch-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profile: "pro" }),
            });
            if (!res.ok) {
              throw new Error(`Seed failed: ${res.status}`);
            }
            localStorage.setItem("demo-profile", "pro");
          } catch {
            // Seed failed — still navigate, dashboard will show whatever data exists
          }
          router.push("/dashboard");
        },
        onError: (error) => {
          setDemoError(error.error.message || "Demo login failed");
          setDemoLoading(false);
        },
      }
    );
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, oklch(0.18 0.04 250 / 50%), transparent 70%)",
      }}
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
        transition={{
          duration: 0.45,
          ease: shouldReduceMotion ? "linear" : [0.16, 1, 0.3, 1],
        }}
      >
        {/* Logo & tagline */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            alt="Pause"
            className="rounded-2xl"
            height={64}
            src="/logo.png"
            style={{
              filter: "drop-shadow(0 0 20px oklch(0.6 0.15 250 / 0.3))",
            }}
            width={64}
          />
          <span
            className="font-semibold text-xl tracking-[-0.01em]"
            style={{ color: "oklch(0.95 0.01 250)" }}
          >
            Pause
          </span>
          <div
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: "oklch(0.55 0.02 250)" }}
          >
            <span>Your AI Guardian</span>
            <NativeFlipText
              className="font-medium"
              duration={2500}
              words={["is waiting", "learns fast", "saves more", "knows you"]}
            />
          </div>
        </div>

        {/* Glass card wrapper */}
        <div
          className="overflow-hidden rounded-2xl border p-6 sm:p-8"
          style={{
            background: "oklch(0.14 0.01 250 / 70%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "oklch(1 0 0 / 0.08)",
            boxShadow:
              "0 8px 40px oklch(0 0 0 / 0.4), 0 0 80px oklch(0.75 0.15 250 / 0.04)",
          }}
        >
          {/* Header badge */}
          <div className="mb-6 text-center">
            <span
              className="inline-flex rounded-full border px-3 py-1 font-medium text-[11px] uppercase tracking-[0.2em]"
              style={{
                borderColor: "oklch(1 0 0 / 0.08)",
                color: "oklch(0.55 0.02 250)",
                background: "oklch(1 0 0 / 0.03)",
              }}
            >
              {showSignIn ? "Sign In" : "Get Started"}
            </span>
          </div>

          {/* Demo button */}
          {IS_DEMO && (
            <>
              <button
                className="w-full rounded-xl px-5 py-3 font-semibold text-[14px] text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                disabled={demoLoading}
                onClick={handleDemoLogin}
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.5 0.18 250), oklch(0.4 0.22 270))",
                  boxShadow:
                    "0 4px 20px oklch(0.4 0.18 250 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.1)",
                }}
                type="button"
              >
                {demoLoading ? "Signing in..." : "Try Demo as Alex"}
              </button>
              {demoError && (
                <p
                  className="mt-2 text-center text-[12px]"
                  style={{ color: "hsl(var(--destructive))" }}
                >
                  {demoError}
                </p>
              )}
              <p
                className="mt-2 text-center text-[11px]"
                style={{ color: "oklch(0.45 0.02 250)" }}
              >
                Pre-loaded with history, savings, and a trained AI
              </p>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div
                  className="h-px flex-1"
                  style={{ background: "oklch(1 0 0 / 0.08)" }}
                />
                <span
                  className="text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: "oklch(0.4 0.02 250)" }}
                >
                  or
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: "oklch(1 0 0 / 0.08)" }}
                />
              </div>
            </>
          )}

          {/* Auth forms */}
          {showSignIn ? (
            <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
          )}
        </div>

        {/* Footer */}
        <p
          className="mt-4 text-center text-[11px]"
          style={{ color: "oklch(0.4 0.02 250)" }}
        >
          By continuing you agree to our terms of service and privacy policy.
        </p>
      </motion.div>
    </div>
  );
}
