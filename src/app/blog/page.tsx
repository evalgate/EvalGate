"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Footer } from "@/components/footer"
import { useSession } from "@/lib/auth-client"

import Link from "next/link"
import { ArrowRight, Calendar } from "lucide-react"

const blogPosts = [
  {
    id: 1,
    title: "Why Every AI Product Needs Evaluation",
    excerpt: "Traditional testing falls short for LLM applications. Learn why evaluation is critical for AI products and how to get started.",
    date: "2025-10-13",
    readTime: "8 min read",
    category: "Best Practices",
    slug: "why-every-ai-product-needs-evaluation"
  },
  {
    id: 2,
    title: "Building Effective LLM Judge Rubrics",
    excerpt: "How to design evaluation criteria that capture quality, relevance, and safety in AI outputs. Real examples from production.",
    date: "2025-10-13",
    readTime: "12 min read",
    category: "Guides",
    slug: "building-effective-llm-judge-rubrics"
  },
  {
    id: 3,
    title: "The Evolution of AI Testing: From Unit Tests to A/B Tests",
    excerpt: "A comprehensive look at evaluation methodologies for AI systems across the development lifecycle.",
    date: "2025-10-13",
    readTime: "10 min read",
    category: "Industry",
    slug: "evolution-of-ai-testing"
  },
  {
    id: 4,
    title: "Case Study: Reducing Support Chatbot Errors by 60%",
    excerpt: "How a SaaS company used systematic evaluation to dramatically improve their AI support agent.",
    date: "2025-10-13",
    readTime: "15 min read",
    category: "Case Studies",
    slug: "case-study-reducing-chatbot-errors"
  },
  {
    id: 5,
    title: "Tracing: The Missing Layer in LLM Observability",
    excerpt: "Why distributed tracing matters for AI applications and what metrics you should be tracking.",
    date: "2025-10-13",
    readTime: "9 min read",
    category: "Technical",
    slug: "tracing-llm-observability"
  },
  {
    id: 6,
    title: "Human-in-the-Loop: When to Use Annotations vs LLM Judges",
    excerpt: "A practical framework for deciding between human review and automated evaluation at scale.",
    date: "2025-10-13",
    readTime: "11 min read",
    category: "Best Practices",
    slug: "human-in-the-loop"
  }
]

export default function BlogPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">Blog</h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
              Insights, best practices, and case studies on AI evaluation
            </p>
          </div>

          {/* Blog Posts */}
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <Card key={post.slug} className="flex flex-col p-5 sm:p-6">
                <div className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                  <time dateTime={post.date}>{post.date}</time>
                </div>
                <div className="mb-2 inline-block">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500">
                    {post.category}
                  </span>
                </div>
                <h2 className="mb-2 text-lg sm:text-xl font-semibold">{post.title}</h2>
                <p className="mb-3 sm:mb-4 flex-1 text-sm sm:text-base text-muted-foreground">{post.excerpt}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm text-muted-foreground">{post.readTime}</span>
                  <Button asChild variant="ghost" size="sm" className="h-8 sm:h-9">
                    <Link href={`/blog/${post.slug}`}>
                      Read more <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}