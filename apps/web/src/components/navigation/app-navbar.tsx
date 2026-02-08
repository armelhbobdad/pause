"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import UserMenu from "@/components/user-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Home" },
] as const;

export function AppNavbar() {
  const pathname = usePathname();

  const activeIndex = navItems.findIndex((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <nav
      className="flex items-center justify-between border-b px-4 py-2"
      data-navbar
    >
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
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
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
      <div className="flex items-center gap-2">
        <UserMenu />
      </div>
    </nav>
  );
}
