"use client"

import { Footer } from "@/components/footer"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogOut } from "lucide-react"
import { useSession } from "@/lib/auth-client"
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
import { HomeHero } from "@/components/home-hero"
import { HomeFeatures } from "@/components/home-features"
import { InteractivePlayground } from "@/components/interactive-playground"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    const { error } = await authClient.signOut()
    if (error?.code) {
      toast.error("Failed to sign out")
    } else {
      toast.success("Signed out successfully")
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
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base">EvalAI</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              {session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 cursor-pointer">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
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

      <main className="flex-1">
        <HomeHero />
        <HomeFeatures />
        
        {/* Interactive Playground Section */}
        <section id="playground" className="py-16 sm:py-20 bg-background scroll-mt-16">
          <div className="container mx-auto px-4">
            <InteractivePlayground
              onSignupPrompt={() => {
                router.push('/auth/sign-up?source=homepage-playground')
              }}
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
