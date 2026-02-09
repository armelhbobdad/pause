"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import dynamic from "next/dynamic";

import { queryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

const TourProvider = dynamic(
  () => import("./demo/tour-provider").then((m) => m.TourProvider),
  { ssr: false }
);

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function MaybeTourProvider({ children }: { children: React.ReactNode }) {
  if (!isDemoMode) {
    return <>{children}</>;
  }
  return <TourProvider>{children}</TourProvider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      forcedTheme="dark"
    >
      <QueryClientProvider client={queryClient}>
        <MaybeTourProvider>{children}</MaybeTourProvider>
        {process.env.NODE_ENV === "development" &&
          !process.env.NEXT_PUBLIC_DEMO_MODE && <ReactQueryDevtools />}
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
