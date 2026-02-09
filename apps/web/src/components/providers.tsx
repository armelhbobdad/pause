"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      forcedTheme="dark"
    >
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" &&
          !process.env.NEXT_PUBLIC_DEMO_MODE && <ReactQueryDevtools />}
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
