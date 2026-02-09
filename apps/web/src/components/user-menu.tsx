"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { NativeButton } from "@/components/uitripled/native-button-shadcnui";
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
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.15 },
  }),
};

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <NativeButton variant="outline">Sign In</NativeButton>
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <NativeButton onClick={() => setOpen((prev) => !prev)} variant="outline">
        {session.user.name}
      </NativeButton>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
            className="absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border p-1"
            exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
            initial={shouldReduceMotion ? { opacity: 0 } : "hidden"}
            role="menu"
            style={{
              background: "var(--pause-glass, oklch(0.14 0.005 250 / 85%))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderColor: "oklch(1 0 0 / 0.12)",
              boxShadow: "0 8px 32px oklch(0 0 0 / 0.4)",
            }}
            variants={menuVariants}
          >
            {/* Header */}
            <motion.div
              className="px-3 py-2"
              custom={0}
              variants={shouldReduceMotion ? undefined : itemVariants}
            >
              <p className="font-semibold text-sm">{session.user.name}</p>
              <p className="text-muted-foreground text-xs">My Account</p>
            </motion.div>

            <div
              className="mx-2 my-1 h-px"
              style={{ background: "oklch(1 0 0 / 0.1)" }}
            />

            {/* Email */}
            <motion.div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground text-sm"
              custom={1}
              role="menuitem"
              variants={shouldReduceMotion ? undefined : itemVariants}
            >
              <Mail className="h-4 w-4" />
              <span className="truncate">{session.user.email}</span>
            </motion.div>

            {/* Sign Out */}
            <motion.button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
              custom={2}
              onClick={() => {
                close();
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/");
                    },
                  },
                });
              }}
              role="menuitem"
              style={{ color: "oklch(0.7 0.15 25)" }}
              type="button"
              variants={shouldReduceMotion ? undefined : itemVariants}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { x: 2, backgroundColor: "oklch(0.7 0.15 25 / 0.1)" }
              }
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
