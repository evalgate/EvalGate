"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useCustomer } from "autumn-js/react"

export function HomeHero() {
  const { data: session } = useSession()
  const { customer } = useCustomer()
  const currentPlan = customer?.products?.[0]
  const planName = currentPlan?.name || "Developer"

  return (
    <section className="py-20 sm:py-32 text-center">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Build Confidence in Your{" "}
          <span className="text-primary">AI Systems</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Comprehensive evaluation platform for testing, monitoring, and improving LLM applications.
          From unit tests to human feedback loops.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {session?.user ? (
            <>
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/evaluations/new">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Create Evaluation
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/sign-up">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={() => {
                  document.getElementById('playground')?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  })
                }}
              >
                Try It Now
              </Button>
              <Link href="/documentation">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                  View Documentation
                </Button>
              </Link>
            </>
          )}
        </div>
        {session?.user && (
          <p className="text-sm text-muted-foreground mt-4">
            Current plan: <span className="font-medium text-foreground">{planName}</span>
          </p>
        )}
      </div>
    </section>
  )
}

