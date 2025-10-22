"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { useSession } from "@/lib/auth-client"

import Link from "next/link"
import { ArrowRight, BookOpen, Code, Zap, Users } from "lucide-react"

const docSections = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Quick start guide and basic concepts",
    links: [
      { label: "Quick Start", href: "/guides/quick-start" },
      { label: "Core Concepts", href: "/documentation#concepts" },
      { label: "Best Practices", href: "/documentation#best-practices" }
    ]
  },
  {
    icon: Code,
    title: "Integrations",
    description: "Connect your LLM applications",
    links: [
      { label: "OpenAI", href: "/guides/openai-integration" },
      { label: "LangChain", href: "/guides/langchain-integration" },
      { label: "CI/CD Integration", href: "/guides/cicd-integration" }
    ]
  },
  {
    icon: Zap,
    title: "Features",
    description: "Deep dives into platform capabilities",
    links: [
      { label: "Evaluations", href: "/evaluations" },
      { label: "Traces", href: "/traces" },
      { label: "LLM Judge", href: "/llm-judge" },
      { label: "Annotations", href: "/annotations" }
    ]
  },
  {
    icon: Users,
    title: "Use Cases",
    description: "Learn from real-world examples",
    links: [
      { label: "Chatbot Evaluation", href: "/guides/chatbot-evaluation" },
      { label: "RAG Evaluation", href: "/guides/rag-evaluation" },
      { label: "Code Generation", href: "/guides/code-generation" }
    ]
  }
]

export default function DocumentationPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">Documentation</h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
              Everything you need to build confidence in your AI systems
            </p>
          </div>

          {/* Documentation Sections */}
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 mb-12 sm:mb-16">
            {docSections.map((section) => {
              const Icon = section.icon
              return (
                <Card key={section.title} className="p-5 sm:p-6">
                  <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  </div>
                  <h2 className="mb-2 text-lg sm:text-xl font-semibold">{section.title}</h2>
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">{section.description}</p>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link 
                          href={link.href}
                          className="group inline-flex items-center text-sm sm:text-base text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          {link.label}
                          <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>

          {/* API Reference CTA */}
          <Card className="p-6 sm:p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">API Reference</h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-4 sm:mb-6 max-w-2xl mx-auto">
                Complete API documentation with code examples and interactive endpoints
              </p>
              <Button asChild size="lg">
                <Link href="/api-reference">
                  View API Reference <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}