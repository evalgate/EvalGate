"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { useSession } from "@/lib/auth-client"

import Link from "next/link"
import { ArrowRight, Code, Zap, BookOpen, Settings } from "lucide-react"

const guides = [
  {
    title: "Quick Start",
    description: "Get up and running with your first evaluation in 5 minutes",
    category: "Getting Started",
    icon: Zap,
    href: "/guides/quick-start"
  },
  {
    title: "OpenAI Integration",
    description: "Connect OpenAI models for evaluation and testing",
    category: "Integrations",
    icon: Code,
    href: "/guides/openai-integration"
  },
  {
    title: "LangChain Integration",
    description: "Integrate LangChain applications with the platform",
    category: "Integrations",
    icon: Code,
    href: "/guides/langchain-integration"
  },
  {
    title: "Chatbot Evaluation",
    description: "Best practices for evaluating conversational AI",
    category: "Use Cases",
    icon: BookOpen,
    href: "/guides/chatbot-evaluation"
  },
  {
    title: "RAG Evaluation",
    description: "Evaluate retrieval-augmented generation systems",
    category: "Use Cases",
    icon: BookOpen,
    href: "/guides/rag-evaluation"
  },
  {
    title: "Code Generation",
    description: "Test and validate code generation models",
    category: "Use Cases",
    icon: BookOpen,
    href: "/guides/code-generation"
  },
  {
    title: "LLM Judge Setup",
    description: "Configure LLM judges for automated evaluation",
    category: "Advanced",
    icon: Settings,
    href: "/guides/llm-judge"
  },
  {
    title: "Tracing Setup",
    description: "Implement distributed tracing for LLM applications",
    category: "Advanced",
    icon: Settings,
    href: "/guides/tracing-setup"
  },
  {
    title: "CI/CD Integration",
    description: "Automate evaluations in your deployment pipeline",
    category: "Advanced",
    icon: Settings,
    href: "/guides/cicd-integration"
  }
]

const categories = ["Getting Started", "Integrations", "Use Cases", "Advanced"]

export default function GuidesPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
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

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">Guides</h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
              Step-by-step tutorials to help you get the most out of the platform
            </p>
          </div>

          {/* Guides by Category */}
          {categories.map((category) => {
            const categoryGuides = guides.filter((guide) => guide.category === category)
            return (
              <section key={category} className="mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{category}</h2>
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryGuides.map((guide) => {
                    const Icon = guide.icon
                    return (
                      <Card key={guide.href} className="p-5 sm:p-6 hover:border-blue-500/50 transition-colors">
                        <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                        </div>
                        <h3 className="mb-2 text-lg sm:text-xl font-semibold">{guide.title}</h3>
                        <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">{guide.description}</p>
                        <Button asChild variant="ghost" size="sm" className="w-full justify-start p-0 h-auto">
                          <Link href={guide.href} className="inline-flex items-center text-blue-500 hover:text-blue-400">
                            Read guide <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}