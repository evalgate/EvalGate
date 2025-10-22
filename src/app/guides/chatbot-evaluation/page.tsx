import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"
import { Footer } from "@/components/footer"
import { ArrowLeft, MessageSquare, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

export default function ChatbotEvaluationGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold tracking-tight">Evaluating Chatbots</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            A comprehensive guide to testing and improving conversational AI systems
          </p>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Key Evaluation Dimensions</h2>
            
            <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h3 className="text-base sm:text-lg font-semibold">Response Quality</h3>
              </div>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>• <strong>Relevance:</strong> Does the response address the user's query?</li>
                <li>• <strong>Accuracy:</strong> Is the information correct and up-to-date?</li>
                <li>• <strong>Completeness:</strong> Does it provide all necessary information?</li>
                <li>• <strong>Clarity:</strong> Is the response easy to understand?</li>
              </ul>
            </div>

            <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <h3 className="text-base sm:text-lg font-semibold">Conversational Flow</h3>
              </div>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>• <strong>Context awareness:</strong> Does it remember previous messages?</li>
                <li>• <strong>Natural language:</strong> Does it sound human and conversational?</li>
                <li>• <strong>Tone consistency:</strong> Is the personality consistent?</li>
                <li>• <strong>Error handling:</strong> How does it handle misunderstandings?</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                <h3 className="text-base sm:text-lg font-semibold">Safety & Guardrails</h3>
              </div>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>• <strong>Harmful content:</strong> Does it avoid toxic or offensive responses?</li>
                <li>• <strong>Privacy:</strong> Does it protect user information?</li>
                <li>• <strong>Boundaries:</strong> Does it refuse inappropriate requests?</li>
                <li>• <strong>Hallucinations:</strong> Does it admit when it doesn't know?</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Creating Test Cases</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Build a comprehensive test suite covering different conversation scenarios:
            </p>
            <div className="rounded-md bg-muted p-3 sm:p-4">
              <code className="text-xs sm:text-sm">
                {`const testCases = [
  {
    category: "happy-path",
    conversation: [
      { role: "user", content: "What are your hours?" },
      { role: "assistant", content: "We're open 9 AM - 6 PM..." }
    ]
  },
  {
    category: "edge-case",
    conversation: [
      { role: "user", content: "asdfgh" },
      { role: "assistant", content: "I didn't understand..." }
    ]
  },
  {
    category: "context-test",
    conversation: [
      { role: "user", content: "I want to book a flight" },
      { role: "assistant", content: "Where would you like to go?" },
      { role: "user", content: "How much would it cost?" },
      // Should reference the booking context
    ]
  }
]`}
              </code>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Automated Evaluation</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Use LLM judges to scale your evaluation process:
            </p>
            <div className="rounded-md bg-muted p-3 sm:p-4">
              <code className="text-xs sm:text-sm">
                {`const evaluation = await platform.evaluate({
  model: "your-chatbot",
  testCases: testCases,
  judges: [
    {
      name: "relevance",
      prompt: "Rate 1-5: How relevant is this response?"
    },
    {
      name: "safety",
      prompt: "Is this response safe and appropriate?"
    }
  ]
})`}
              </code>
            </div>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Human Review</h2>
            <p className="mb-4 text-sm sm:text-base text-muted-foreground">
              Combine automated testing with human evaluation for the best results:
            </p>
            <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
              <li>• Review a sample of conversations weekly</li>
              <li>• Focus on edge cases and failed interactions</li>
              <li>• Collect user feedback through ratings and surveys</li>
              <li>• Use human feedback to improve your judges</li>
            </ul>
          </section>

          <section className="mb-8 sm:mb-12">
            <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold">Common Pitfalls</h2>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Over-optimizing</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Don't just optimize for test cases. Ensure your chatbot handles novel user inputs gracefully.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Ignoring Context</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Test multi-turn conversations, not just single exchanges. Context is critical for chatbots.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">No Monitoring</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Evaluation doesn't end at deployment. Continuously monitor production conversations.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <h3 className="mb-2 text-base sm:text-lg font-semibold">Weak Safety Checks</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Always include adversarial test cases and safety evaluations in your test suite.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dashboard">Start Evaluating</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/guides">View All Guides</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}