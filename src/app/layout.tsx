import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chainly — AI Blockchain Agent",
  description: "Chat with an AI agent that reads Base Sepolia, analyzes wallets and safely prepares transactions.",
};

export const viewport: Viewport = {
  themeColor: "#0d0f17",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased`}>
      <body className="h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
