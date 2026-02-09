"use client";

import Image from "next/image";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { NativeFlipText } from "@/components/uitripled/native-flip-text-carbon";

export default function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(false);

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
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </div>
  );
}
