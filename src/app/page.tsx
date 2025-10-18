"use client"

import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { ArrowRight, Beaker, Users, Zap, Sparkles, LogOut } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useCustomer } from "autumn-js/react"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const { data: session, isPending, refetch } = useSession()
  const { customer, isLoading: isLoadingCustomer } = useCustomer()
  const router = useRouter()

  const currentPlan = customer?.products?.[0]
  const planName = currentPlan?.name || "Developer"

  const handleSignOut = async () => {
    const { error } = await authClient.signOut()
    if (error?.code) {
      toast.error("Failed to sign out")
    } else {
      localStorage.removeItem("bearer_token")
      refetch()
      router.push("/")
    }
  }

  const initials = session?.user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base sm:text-xl font-bold truncate">AI Evaluation Platform</h1>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <ThemeToggle />
              {isPending ? (
                <div className="h-9 w-16 sm:w-20 animate-pulse bg-muted rounded" />
              ) : session?.user ? (
                <>
                  {!isLoadingCustomer && (
                    <Link href="/pricing" className="hidden sm:block">
                      <Button variant="outline" size="sm" className="h-9 gap-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">{planName}</span>
                      </Button>
                    </Link>
                  )}
                  <Button asChild size="sm" className="h-9">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{session.user.name || "User"}</p>
                          <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
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

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 flex-1">
        <div className="py-12 sm:py-16 md:py-24 text-center">
          <div className="mb-4 sm:mb-6 inline-block rounded-full bg-blue-500/10 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-blue-400">
            Ship LLM products that work
          </div>
          <h2 className="mb-4 sm:mb-6 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance px-2">
            The end-to-end platform for <span className="text-blue-500">AI evaluation</span>
          </h2>
          <p className="mx-auto mb-6 sm:mb-8 max-w-2xl text-base sm:text-lg text-muted-foreground text-balance px-2">
            Build confidence in your AI systems with comprehensive evaluation tools. From unit tests to human feedback
            to A/B testing in production.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            {session?.user ? (
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/auth/sign-up">
                    Get started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-6 sm:gap-8 py-12 sm:py-16 md:py-24 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Beaker className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <h3 className="mb-2 text-lg sm:text-xl font-semibold">Unit Testing</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Write assertions to validate LLM outputs. Catch regressions before they reach production.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <h3 className="mb-2 text-lg sm:text-xl font-semibold">Human Evaluation</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Get expert feedback on model responses. Use LLM judges to scale your evaluation process.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <h3 className="mb-2 text-lg sm:text-xl font-semibold">A/B Testing</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Test changes in production with confidence. Measure real user impact with statistical rigor.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}