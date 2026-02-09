"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
] as const;

const futureTabIcons = [
  {
    label: "Card",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  {
    label: "Chat",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
] as const;

interface BottomTabBarProps {
  hidden?: boolean;
}

export function BottomTabBar({ hidden = false }: BottomTabBarProps) {
  const pathname = usePathname();

  if (hidden) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background sm:hidden"
      data-testid="bottom-tab-bar"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <li className="flex-1" key={tab.href}>
              <Link
                className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 text-xs transition-colors"
                href={tab.href}
                style={{
                  color: isActive
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
                }}
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    d={tab.icon}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
        {futureTabIcons.map((tab) => (
          <li className="flex-1" key={tab.label}>
            <span
              className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 text-xs"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  d={tab.icon}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{tab.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
