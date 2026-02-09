"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Skeleton } from "./ui/skeleton";

const menuVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.12, ease: "easeIn" as const },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.14 },
  }),
};

export default function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (isPending) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!session) {
    return (
      <Link
        className="rounded-full px-3.5 py-1.5 font-medium text-[13px] transition-colors"
        href="/login"
        style={{
          color: "oklch(0.9 0.01 250)",
          background: "oklch(1 0 0 / 0.06)",
          border: "1px solid oklch(1 0 0 / 0.1)",
        }}
      >
        Sign In
      </Link>
    );
  }

  // Get initials for avatar
  const initials = (session.user.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full font-semibold text-[11px] transition-all"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: "oklch(0.25 0.04 250)",
          color: "oklch(0.8 0.08 250)",
          border: "1px solid oklch(1 0 0 / 0.1)",
        }}
        type="button"
      >
        {initials}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
            className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border p-1"
            exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
            initial={shouldReduceMotion ? { opacity: 0 } : "hidden"}
            role="menu"
            style={{
              background: "oklch(0.13 0.008 250 / 90%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderColor: "oklch(1 0 0 / 0.08)",
              boxShadow:
                "0 8px 32px oklch(0 0 0 / 0.4), 0 0 0 1px oklch(1 0 0 / 0.03)",
            }}
            variants={menuVariants}
          >
            {/* Header */}
            <motion.div
              className="flex items-center gap-2.5 px-3 py-2"
              custom={0}
              variants={shouldReduceMotion ? undefined : itemVariants}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full font-semibold text-[10px]"
                style={{
                  background: "oklch(0.3 0.05 250)",
                  color: "oklch(0.8 0.08 250)",
                }}
              >
                {initials}
              </div>
              <div>
                <p className="font-medium text-[13px] leading-tight">
                  {session.user.name}
                </p>
                <p
                  className="text-[11px] leading-tight"
                  style={{ color: "oklch(0.5 0.02 250)" }}
                >
                  Account
                </p>
              </div>
            </motion.div>

            <div
              className="mx-2 my-1 h-px"
              style={{ background: "oklch(1 0 0 / 0.06)" }}
            />

            {/* Email */}
            <motion.div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px]"
              custom={1}
              role="menuitem"
              style={{ color: "oklch(0.55 0.02 250)" }}
              variants={shouldReduceMotion ? undefined : itemVariants}
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{session.user.email}</span>
            </motion.div>

            {/* Sign Out — onMouseDown fires before document handler can close menu */}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors hover:bg-white/5"
              onClick={() => {
                window.location.href = "/api/sign-out";
              }}
              onMouseDown={() => {
                window.location.href = "/api/sign-out";
              }}
              role="menuitem"
              style={{ color: "oklch(0.65 0.14 25)" }}
              type="button"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
