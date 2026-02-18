import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import CustomAutumnProvider from "@/lib/autumn-provider";
import "./globals.css";
import Script from "next/script";
import ErrorReporter from "@/components/ErrorReporter";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import { SkipToContent } from "@/components/ui/skip-to-content";
import { WebMCPProvider } from "@/components/webmcp-provider";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";

export const metadata: Metadata = {
  title: "AI Evaluation Platform — Observability, Evaluation & Governance for AI Agents",
  description:
    "Open-source platform for multi-agent workflow tracing, LLM cost analytics, decision auditing, and governance. Published TypeScript SDK on npm (@pauly4010/evalai-sdk). REST API for Python/Go/Rust. Integrates with LangChain, CrewAI, AutoGen.",
  generator: "EvalAI",
  keywords: [
    "ai evaluation",
    "llm observability",
    "agent tracing",
    "workflow dag",
    "cost tracking",
    "decision auditing",
    "governance",
    "evalai",
    "typescript sdk",
    "multi-agent",
    "langchain",
    "crewai",
    "autogen",
  ],
  openGraph: {
    title: "EvalAI — AI Evaluation Platform",
    description:
      "Open-source observability, evaluation, and governance for AI agents. npm SDK + REST API.",
    type: "website",
    siteName: "EvalAI",
  },
  alternates: {
    canonical: "https://v0-ai-evaluation-platform-nu.vercel.app",
  },
  other: {
    "llms.txt": "/llms.txt",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="antialiased font-sans">
        <SkipToContent />
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        <Suspense fallback={null}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <CustomAutumnProvider>
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
            </CustomAutumnProvider>
            <Toaster />
            <KeyboardShortcutsHelp />
          </ThemeProvider>
        </Suspense>
        <Analytics />
        <WebMCPProvider />
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
