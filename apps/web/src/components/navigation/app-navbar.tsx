"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  Github,
  Microscope,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import UserMenu from "@/components/user-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Home" },
] as const;

const guideLinks = [
  {
    href: "https://github.com/armelhbobdad/pause/blob/main/DEMO_MODE.md",
    label: "Demo Guide",
    icon: BookOpen,
  },
  {
    href: "https://medium.com/@armelhbobdad/deep-dive-how-pause-turns-impulse-spending-into-smarter-decisions-f07b22442970",
    label: "How Pause Works",
    icon: FileText,
  },
  {
    href: "https://dev.to/armelhbobdad/deep-dive-self-improving-ai-with-ace-skillbooks-2300",
    label: "Self-Improving AI with ACE",
    icon: Microscope,
  },
  {
    href: "https://dev.to/armelhbobdad/deep-dive-building-observable-ai-with-opik-2424",
    label: "Observable AI with Opik",
    icon: Eye,
  },
] as const;

const dropdownVariants = {
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

const dropdownItemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.14 },
  }),
};

function GuideDropdown() {
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
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex items-center gap-1 px-3 py-1.5 font-medium text-[13px] transition-colors max-sm:px-2"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          color: open ? "oklch(0.95 0.01 250)" : "oklch(0.55 0.02 250)",
        }}
        type="button"
        whileHover={shouldReduceMotion ? {} : { color: "oklch(0.85 0.02 250)" }}
      >
        Guide
        <ChevronDown
          className="h-3 w-3 transition-transform"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
            className="absolute left-1/2 z-50 mt-1 w-60 -translate-x-1/2 overflow-hidden rounded-xl border p-1"
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
            variants={dropdownVariants}
          >
            {guideLinks.map((link, i) => (
              <motion.a
                className="group flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] transition-colors hover:bg-white/[0.08]"
                custom={i}
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
                rel="noopener"
                role="menuitem"
                style={{ color: "oklch(0.65 0.02 250)" }}
                target="_blank"
                variants={shouldReduceMotion ? undefined : dropdownItemVariants}
              >
                <link.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{link.label}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppNavbar() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const activeIndex = navItems.findIndex((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <nav
      className="relative z-[var(--z-float)] flex items-center justify-between px-5 py-2.5"
      data-navbar
      style={{
        background: "oklch(0.1 0.005 250 / 60%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid oklch(1 0 0 / 0.06)",
      }}
    >
      {/* Logo */}
      <Link className="flex items-center gap-2.5" href="/">
        <Image
          alt="Pause"
          className="rounded-lg"
          height={26}
          src="/logo.png"
          width={26}
        />
        <span
          className="font-semibold text-[15px] tracking-[-0.01em] max-sm:hidden"
          style={{ color: "oklch(0.95 0.01 250)" }}
        >
          Pause
        </span>
      </Link>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        {navItems.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <Link
              className="relative px-3 py-1.5 font-medium text-[13px] transition-colors max-sm:px-2"
              href={item.href}
              key={item.href}
              style={{
                color: isActive
                  ? "oklch(0.95 0.01 250)"
                  : "oklch(0.55 0.02 250)",
              }}
            >
              <motion.span
                whileHover={
                  shouldReduceMotion ? {} : { color: "oklch(0.85 0.02 250)" }
                }
              >
                {item.label}
              </motion.span>
              {isActive && (
                <motion.div
                  className="absolute right-3 bottom-0 left-3 h-[1.5px]"
                  layoutId="nav-underline"
                  style={{
                    background:
                      "linear-gradient(90deg, oklch(0.75 0.15 250), oklch(0.65 0.12 280))",
                    borderRadius: "1px",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 32,
                  }}
                />
              )}
            </Link>
          );
        })}
        <GuideDropdown />
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-2">
        <motion.a
          aria-label="View source on GitHub"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          href="https://github.com/armelhbobdad/pause"
          rel="noopener"
          style={{
            color: "oklch(0.55 0.02 250)",
            border: "1px solid oklch(1 0 0 / 0.08)",
          }}
          target="_blank"
          whileHover={
            shouldReduceMotion
              ? {}
              : {
                  color: "oklch(0.85 0.02 250)",
                  borderColor: "oklch(1 0 0 / 0.15)",
                }
          }
        >
          <Github className="h-4 w-4" />
        </motion.a>
        <UserMenu />
      </div>
    </nav>
  );
}
