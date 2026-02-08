import type { Metadata } from "next";

import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

import "../index.css";
import { AppNavbar } from "@/components/navigation/app-navbar";
import Providers from "@/components/providers";
import { DemoBadge } from "@/components/ui/demo-badge";
import { FloatingChatWidget } from "@/components/uitripled/floating-chat-widget-shadcnui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "pause",
  description: "pause",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          <DemoBadge />
          <div className="grid h-dvh grid-rows-[auto_1fr]">
            <AppNavbar />
            {children}
          </div>
          <FloatingChatWidget />
        </Providers>
      </body>
    </html>
  );
}
