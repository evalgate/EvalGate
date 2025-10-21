import type React from "react"
import type { Metadata } from "next"
// eslint-disable-next-line import/no-unresolved
import { GeistSans } from "geist/font/sans"
// eslint-disable-next-line import/no-unresolved
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { Suspense } from "react"
import CustomAutumnProvider from "@/lib/autumn-provider"
import "./globals.css"
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import { ErrorBoundary } from "@/components/error-boundary";
import { SkipToContent } from "@/components/ui/skip-to-content";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AI Evaluation Platform",
  description: "Comprehensive AI evaluation and testing platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
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
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
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
        <VisualEditsMessenger />
      </body>
    </html>
  )
}