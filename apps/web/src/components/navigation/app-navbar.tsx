"use client";

import { motion, useReducedMotion } from "framer-motion";
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
      className="flex items-center justify-between border-b px-4 py-2"
      data-navbar
      style={{
        background: "oklch(0.12 0.005 250 / 90%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-6">
        <Link className="flex items-center gap-1.5 pl-1" href="/">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background: "var(--accent-glow)",
              boxShadow: "0 0 8px var(--accent-glow)",
            }}
          />
          <span
            className="font-bold text-lg tracking-tight"
            style={{ color: "var(--text-hero)" }}
          >
            pause
          </span>
        </Link>
        <ul className="flex gap-1">
          {navItems.map((item, index) => (
            <li className="relative" key={item.href}>
              <Link
                className="relative z-10 block px-4 py-2 font-medium text-sm transition-colors"
                href={item.href}
                style={{
                  color:
                    activeIndex === index
                      ? "var(--primary-foreground)"
                      : "var(--muted-foreground)",
                }}
              >
                <motion.span
                  whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
                >
                  {item.label}
                </motion.span>
              </Link>
              {activeIndex === index && (
                <motion.div
                  className="absolute inset-0 rounded-lg bg-accent"
                  layoutId="navbar-indicator"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2">
        <UserMenu />
      </div>
    </nav>
  );
}
