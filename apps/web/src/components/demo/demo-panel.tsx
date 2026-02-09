"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapIcon, Sprout, Trophy, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTour } from "./tour-provider";

interface MenuItem {
  id: "rookie" | "pro" | "tour";
  label: string;
  description: string;
  icon: typeof Sprout;
  accentColor: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "rookie",
    label: "Rookie Profile",
    description: "Fresh user, no history",
    icon: Sprout,
    accentColor: "oklch(0.72 0.19 145)",
  },
  {
    id: "pro",
    label: "Pro Profile",
    description: "30 days history, trained AI",
    icon: Trophy,
    accentColor: "oklch(0.78 0.16 85)",
  },
  {
    id: "tour",
    label: "Start Guided Tour",
    description: "Walk through key features",
    icon: MapIcon,
    accentColor: "oklch(0.75 0.15 250)",
  },
];

/**
 * Env-check wrapper. Renders nothing when DEMO_MODE is off.
 * Splits rendering so DemoPanelContent can safely call useOnboarding().
 */
export function DemoPanel() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return null;
  }
  return <DemoPanelContent />;
}

function DemoPanelContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [hasPulsed, setHasPulsed] = useState(false);
  const [currentProfile] = useState<"rookie" | "pro">(
    () =>
      (typeof window !== "undefined"
        ? (localStorage.getItem("demo-profile") as "rookie" | "pro")
        : null) ?? "pro"
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const { startTour } = useTour();
  const isOnDashboard = pathname === "/dashboard";

  // 3-second entrance pulse to draw judge's eye
  useEffect(() => {
    if (hasPulsed) {
      return;
    }
    const timer = setTimeout(() => setHasPulsed(true), 3000);
    return () => clearTimeout(timer);
  }, [hasPulsed]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleProfileSwitch = useCallback(async (profile: "rookie" | "pro") => {
    setLoadingId(profile);
    try {
      const res = await fetch("/api/demo/switch-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) {
        throw new Error("Switch failed");
      }
      setIsOpen(false);
      localStorage.setItem("demo-profile", profile);
      // Same demo user, just different data — reload dashboard to reflect changes
      window.location.assign("/dashboard");
    } catch {
      setLoadingId(null);
      toast.error("Profile switch failed. Please try again.");
    }
  }, []);

  const handleTourStart = useCallback(() => {
    setIsOpen(false);
    startTour();
  }, [startTour]);

  const handleItemClick = useCallback(
    (id: MenuItem["id"]) => {
      if (id === "tour") {
        handleTourStart();
      } else {
        handleProfileSwitch(id);
      }
    },
    [handleTourStart, handleProfileSwitch]
  );

  return (
    <div
      id="tour-demo-panel"
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: "var(--z-float)",
      }}
    >
      {/* Floating DEMO Pill Trigger */}
      <motion.button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close demo panel" : "Open demo panel"}
        className="group relative cursor-pointer overflow-hidden"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          padding: "8px 20px",
          borderRadius: 12,
          fontFamily: "var(--font-data)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.1em",
          lineHeight: "22px",
          color: "oklch(0.95 0.03 260)",
          border: "1px solid oklch(0.55 0.18 260 / 0.5)",
          background:
            "linear-gradient(135deg, oklch(0.28 0.12 260 / 0.95), oklch(0.22 0.15 280 / 0.95))",
          boxShadow: isOpen
            ? "0 0 0 2px oklch(0.65 0.2 260 / 0.4), 0 4px 20px oklch(0.3 0.15 260 / 0.5)"
            : "0 2px 12px oklch(0.2 0.12 260 / 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        type="button"
        whileHover={shouldReduceMotion ? {} : { scale: 1.04, y: -1 }}
        whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
      >
        {/* Entrance pulse glow */}
        {!(hasPulsed || shouldReduceMotion) && (
          <motion.span
            animate={{
              opacity: [0, 0.6, 0],
              scale: [1, 1.6, 2],
            }}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 16,
              border: "2px solid oklch(0.7 0.2 260 / 0.6)",
              pointerEvents: "none",
            }}
            transition={{
              duration: 1.5,
              repeat: 1,
              ease: "easeOut",
            }}
          />
        )}

        {/* Shimmer sweep on the pill */}
        {!shouldReduceMotion && (
          <motion.span
            animate={{ x: ["-120%", "120%"] }}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.08) 50%, transparent 100%)",
              pointerEvents: "none",
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
              repeatDelay: 4,
            }}
          />
        )}

        <span style={{ position: "relative", zIndex: 1 }}>
          {isOpen ? (
            <X aria-hidden="true" size={16} strokeWidth={2.5} />
          ) : (
            "DEMO"
          )}
        </span>
      </motion.button>

      {/* Menu Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            role="menu"
            style={{
              position: "absolute",
              bottom: "calc(100% + 12px)",
              left: 0,
              width: 280,
              padding: 6,
              borderRadius: 16,
              background: "oklch(0.14 0.015 260 / 0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid oklch(1 0 0 / 0.1)",
              boxShadow:
                "0 -4px 40px oklch(0.2 0.1 260 / 0.3), 0 0 1px oklch(1 0 0 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.05)",
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }
            }
          >
            {/* Subtle top edge glow */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 20,
                right: 20,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, oklch(0.7 0.15 260 / 0.4), transparent)",
              }}
            />

            {MENU_ITEMS.filter(
              (item) =>
                (item.id !== currentProfile || !isOnDashboard) &&
                (item.id !== "tour" || isOnDashboard)
            ).map((item, index) => {
              const Icon = item.icon;
              const isLoading = loadingId === item.id;
              const isDisabled = loadingId !== null;

              return (
                <motion.button
                  animate={{ opacity: 1, x: 0 }}
                  aria-disabled={isDisabled}
                  className="group relative w-full cursor-pointer"
                  disabled={isDisabled}
                  initial={
                    shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -12 }
                  }
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  role="menuitem"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    transition: "background 150ms ease",
                    opacity: isDisabled && !isLoading ? 0.5 : 1,
                  }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          delay: index * 0.06,
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }
                  }
                  type="button"
                  whileHover={
                    isDisabled ? {} : { backgroundColor: "oklch(1 0 0 / 0.06)" }
                  }
                >
                  {/* Icon container with accent glow */}
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `color-mix(in oklch, ${item.accentColor} 15%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${item.accentColor} 25%, transparent)`,
                      flexShrink: 0,
                    }}
                  >
                    {isLoading ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        style={{
                          width: 16,
                          height: 16,
                          border: `2px solid ${item.accentColor}`,
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "linear",
                        }}
                      />
                    ) : (
                      <Icon
                        color={item.accentColor}
                        size={18}
                        strokeWidth={2}
                      />
                    )}
                  </span>

                  {/* Text */}
                  <span
                    style={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "oklch(0.92 0.01 250)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 400,
                        color: "oklch(0.6 0.01 250)",
                        letterSpacing: "0.005em",
                      }}
                    >
                      {item.description}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
