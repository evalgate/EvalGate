import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { PublicPageHeader } from "@/components/public-page-header"
import { Calendar, Clock, ArrowLeft } from "lucide-react"

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Button variant="ghost" size="sm" asChild className="mb-4 sm:mb-6">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back to Blog
          </Link>
        </Button>

        <article>
          <div className="mb-6 sm:mb-8">
            <div className="inline-block bg-blue-500/10 text-blue-500 px-2.5 sm:px-3 py-1 rounded text-xs font-medium mb-3 sm:mb-4">
              Case Studies
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Case Study: Reducing Support Chatbot Errors by 60%</h1>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>15 min read</span>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              How a SaaS company used systematic evaluation to dramatically improve their AI support agent 
              and increase customer satisfaction by 40%.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Challenge</h2>
            <p className="text-muted-foreground mb-4">
              TechFlow (name changed), a B2B SaaS platform with 50,000 users, launched an AI support chatbot 
              to handle common customer questions. The goal was ambitious: deflect 60% of support tickets and 
              reduce response time from hours to seconds.
            </p>
            <p className="text-muted-foreground mb-4">
              Initial results were promising. The chatbot handled thousands of conversations per week, and 
              customers praised the instant responses. But the support team noticed a troubling pattern: 
              escalations to human agents were increasing, not decreasing.
            </p>
            <p className="text-muted-foreground mb-4">
              The problem? The chatbot was confident but often wrong. It would confidently state incorrect 
              information about features, billing, or account settings. Users would try to follow its advice, 
              fail, get frustrated, and escalate to human support—now with two problems instead of one.
            </p>

            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h4 className="font-semibold mb-3">Key Metrics Before Intervention:</h4>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>📊 Deflection rate: 35% (target was 60%)</li>
                <li>❌ Error rate: ~18% of responses contained factual errors</li>
                <li>😞 Customer satisfaction: 3.2/5 (down from 4.1/5 with human-only support)</li>
                <li>⏰ Escalation time: 47% higher than pre-chatbot baseline</li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Approach: Systematic Evaluation</h2>
            <p className="text-muted-foreground mb-4">
              TechFlow's engineering team partnered with their support leads to build a comprehensive 
              evaluation system. Here's how they did it:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Phase 1: Understanding the Problem (Week 1-2)</h3>
            <p className="text-muted-foreground mb-4">
              First, they needed to quantify what "good" looked like. The support team manually reviewed 
              500 chatbot conversations and categorized errors:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Hallucinations (42%):</strong> Made up features that don't exist</li>
              <li><strong>Outdated info (28%):</strong> Correct 6 months ago, wrong now</li>
              <li><strong>Misunderstanding intent (18%):</strong> Answered the wrong question</li>
              <li><strong>Wrong tone (12%):</strong> Too casual or dismissive for enterprise customers</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              They also created a gold standard test set of 150 real customer questions with expert-reviewed 
              "ideal" responses, covering common scenarios and known failure modes.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Phase 2: Building Evaluation Infrastructure (Week 3-4)</h3>
            <p className="text-muted-foreground mb-4">
              With the test set in hand, they implemented automated evaluation:
            </p>

            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm font-medium mb-2">LLM Judge Rubric (Simplified)</p>
              <code className="text-xs block">
{`Evaluate the support chatbot response on these criteria:

1. Factual Accuracy (Pass/Fail)
   - All information must be verifiable in our documentation
   - Mark FAIL if any claims are unsupported or incorrect

2. Completeness (1-5)
   - 5: Fully answers the question with clear next steps
   - 3: Partially answers, missing important details
   - 1: Doesn't address the actual question

3. Tone (Pass/Fail)
   - Must be professional, empathetic, and enterprise-appropriate
   - Mark FAIL if dismissive, overly casual, or robotic

4. Safety (Pass/Fail)
   - Must not promise features we don't have
   - Must not make guarantees about timelines or pricing`}
              </code>
            </div>

            <p className="text-muted-foreground mb-4">
              They ran their current chatbot through this evaluation: 67/150 test cases failed (55% pass rate). 
              Now they had a baseline to improve against.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Phase 3: Iterative Improvement (Week 5-12)</h3>
            <p className="text-muted-foreground mb-4">
              Armed with data, they systematically addressed each failure category:
            </p>

            <p className="text-muted-foreground mb-4"><strong>Iteration 1: Fix Hallucinations</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Implemented RAG (Retrieval-Augmented Generation) with up-to-date documentation</li>
              <li>Added explicit instruction: "Only answer based on provided context. If unsure, say so."</li>
              <li><strong>Result:</strong> Test pass rate improved from 55% → 72%</li>
            </ul>

            <p className="text-muted-foreground mb-4"><strong>Iteration 2: Update Knowledge Base</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Audited all documentation for accuracy and freshness</li>
              <li>Added version tags and last-updated dates</li>
              <li>Set up weekly syncs between product and support to flag changes</li>
              <li><strong>Result:</strong> Test pass rate improved to 81%</li>
            </ul>

            <p className="text-muted-foreground mb-4"><strong>Iteration 3: Better Intent Recognition</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Fine-tuned intent classifier on real support tickets</li>
              <li>Added clarifying questions for ambiguous requests</li>
              <li><strong>Result:</strong> Test pass rate improved to 89%</li>
            </ul>

            <p className="text-muted-foreground mb-4"><strong>Iteration 4: Tone Refinement</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Updated system prompt with tone examples from top-rated human responses</li>
              <li>Added empathy templates for common frustrations</li>
              <li><strong>Result:</strong> Test pass rate improved to 93%</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">Phase 4: Production Validation (Week 13-16)</h3>
            <p className="text-muted-foreground mb-4">
              With strong eval performance, they rolled out the improved chatbot to 10% of users. They tracked:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Deflection rate (did users resolve their issue without escalating?)</li>
              <li>Customer satisfaction scores</li>
              <li>Escalation reasons (what still wasn't working?)</li>
              <li>Average resolution time</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              The A/B test confirmed eval gains translated to production improvements. They expanded to 100% 
              of traffic.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Results</h2>
            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h4 className="font-semibold mb-4">After 16 Weeks of Systematic Evaluation:</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">📊 Deflection Rate</p>
                  <p className="text-sm text-muted-foreground">35% → 58% (+66%)</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">✅ Error Rate</p>
                  <p className="text-sm text-muted-foreground">18% → 7% (-61%)</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">😊 Customer Satisfaction</p>
                  <p className="text-sm text-muted-foreground">3.2/5 → 4.3/5 (+34%)</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">⚡ Resolution Time</p>
                  <p className="text-sm text-muted-foreground">8.2 min → 2.1 min (-74%)</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">💰 Support Cost</p>
                  <p className="text-sm text-muted-foreground">-42% YoY</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">📈 Eval Pass Rate</p>
                  <p className="text-sm text-muted-foreground">55% → 93% (+69%)</p>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Key Lessons Learned</h2>
            
            <p className="text-muted-foreground mb-4"><strong>1. Measurement enables improvement</strong></p>
            <p className="text-muted-foreground mb-4">
              Before building evals, the team was flying blind. They knew the chatbot had issues but couldn't 
              quantify them or track progress. Once they had metrics, improvement was straightforward.
            </p>

            <p className="text-muted-foreground mb-4"><strong>2. Start with human expertise</strong></p>
            <p className="text-muted-foreground mb-4">
              The support team's domain knowledge was critical for building effective rubrics. Engineers alone 
              wouldn't have identified the right evaluation criteria.
            </p>

            <p className="text-muted-foreground mb-4"><strong>3. Iterate in small batches</strong></p>
            <p className="text-muted-foreground mb-4">
              Rather than one big rewrite, they made targeted improvements and measured impact after each change. 
              This made it easy to identify what worked and what didn't.
            </p>

            <p className="text-muted-foreground mb-4"><strong>4. Offline evals predict production performance</strong></p>
            <p className="text-muted-foreground mb-4">
              The correlation between eval pass rate and production metrics was strong (r=0.89). This gave the 
              team confidence to ship changes without long A/B tests for every iteration.
            </p>

            <p className="text-muted-foreground mb-4"><strong>5. Evaluation is ongoing, not one-time</strong></p>
            <p className="text-muted-foreground mb-4">
              TechFlow now runs evals on every code change and continuously expands their test set based on 
              production failures. Evaluation became part of their development workflow, not a separate phase.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">What's Next</h2>
            <p className="text-muted-foreground mb-4">
              With a solid foundation, TechFlow is now:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Expanding to proactive support (predicting issues before users report them)</li>
              <li>Building multilingual support with language-specific eval sets</li>
              <li>Experimenting with different LLM models and comparing performance</li>
              <li>Training a custom judge model on their domain-specific quality standards</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Build Better AI Support</h3>
              <p className="text-sm text-muted-foreground mb-4">
                See how our platform can help you evaluate and improve your AI chatbot. Includes templates 
                for customer support use cases.
              </p>
              <Button asChild>
                <Link href="/guides/chatbot-evaluation">Read the Guide</Link>
              </Button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}