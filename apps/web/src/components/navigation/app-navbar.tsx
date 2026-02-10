"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import UserMenu from "@/components/user-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Home" },
] as const;

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
      </div>

      {/* User menu */}
      <UserMenu />
    </nav>
  );
}
