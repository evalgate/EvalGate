"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession } from "@/lib/auth-client"
import Link from "next/link"

export function PublicPageHeader() {
  const { data: session } = useSession()

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/">
            <h1 className="text-base sm:text-xl font-bold truncate">AI Evaluation Platform</h1>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <ThemeToggle />
            {session?.user ? (
              <Button asChild size="sm" className="h-9">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild size="sm" className="h-9 hidden sm:flex">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-9">
                  <Link href="/auth/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
