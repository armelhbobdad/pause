"use client";

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
  const [showSignIn, setShowSignIn] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setDemoError("");
    await authClient.signIn.email(
      { email: "alex@demo.pause.app", password: "demopass1" },
      {
        onSuccess: () => router.push("/dashboard"),
        onError: (error) => {
          setDemoError(error.error.message || "Demo login failed");
          setDemoLoading(false);
        },
      }
    );
  };

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, oklch(0.2 0.04 250 / 40%), transparent 70%)",
      }}
    >
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex flex-col items-center gap-3">
          <Image
            alt="Pause"
            className="rounded-2xl drop-shadow-[0_0_24px_rgba(56,136,255,0.4)]"
            height={80}
            src="/logo.png"
            width={80}
          />
          <span
            className="font-bold text-2xl tracking-tight"
            style={{ color: "var(--text-hero)" }}
          >
            pause
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Your AI Guardian</span>
          <NativeFlipText
            className="font-medium"
            duration={2500}
            words={["is waiting", "learns fast", "saves more", "knows you"]}
          />
        </div>
      </div>

      {IS_DEMO && (
        <div className="mb-4 w-full max-w-[480px]">
          <button
            className="w-full rounded-xl px-6 py-3.5 font-semibold text-base text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            disabled={demoLoading}
            onClick={handleDemoLogin}
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.2 260), oklch(0.45 0.25 280))",
              boxShadow:
                "0 4px 20px oklch(0.4 0.2 260 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.15)",
            }}
            type="button"
          >
            {demoLoading ? "Signing in..." : "Try Demo as Alex"}
          </button>
          {demoError && (
            <p
              className="mt-2 text-center text-sm"
              style={{ color: "hsl(var(--destructive))" }}
            >
              {demoError}
            </p>
          )}
          <p
            className="mt-2 text-center text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            Pre-loaded with history, savings, and a trained AI
          </p>
        </div>
      )}

      {IS_DEMO && (
        <div
          className="mb-4 flex w-full max-w-[480px] items-center gap-3"
          style={{ color: "var(--text-secondary)" }}
        >
          <div
            className="h-px flex-1"
            style={{ background: "oklch(1 0 0 / 0.15)" }}
          />
          <span className="text-xs">or create your own account</span>
          <div
            className="h-px flex-1"
            style={{ background: "oklch(1 0 0 / 0.15)" }}
          />
        </div>
      )}

      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </div>
  );
}
