"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export function PricingHeader() {
  const { data: session, isPending } = useSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" size="sm" asChild className="h-9 flex-shrink-0">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <ThemeToggle />
            {isPending ? (
              <div className="h-9 w-16 sm:w-20 animate-pulse bg-muted rounded" />
            ) : session?.user ? (
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
  );
}
