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
            <div className="inline-block bg-blue-500/10 text-blue-500 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded text-xs font-medium mb-3 sm:mb-4">
              Guides
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">Building Effective LLM Judge Rubrics</h1>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>12 min read</span>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              How to design evaluation criteria that capture quality, relevance, and safety in AI outputs. 
              Real examples from production systems.
            </p>

            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 mt-6 sm:mt-8">What is an LLM Judge?</h2>
            <p className="text-muted-foreground mb-4">
              An LLM judge is a strong language model (like GPT-4 or Claude-3.5) that evaluates outputs 
              from your production model. Think of it as an automated code reviewer, but for natural language.
            </p>
            <p className="text-muted-foreground mb-4">
              The key to effective LLM judging is the rubric—a clear, detailed specification of what 
              "good" looks like for your use case. A well-designed rubric can achieve 85-95% agreement 
              with human experts while being 100x faster and cheaper.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Anatomy of a Good Rubric</h2>
            <p className="text-muted-foreground mb-4">
              Effective rubrics have three components:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">1. Clear Evaluation Criteria</h3>
            <p className="text-muted-foreground mb-4">
              Define specific, measurable dimensions of quality. Avoid vague terms like "good" or "natural."
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm mb-2"><strong>❌ Bad:</strong> "Is the response helpful?"</p>
              <p className="text-sm"><strong>✅ Good:</strong> "Does the response directly answer the user's question with accurate information?"</p>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">2. Concrete Examples</h3>
            <p className="text-muted-foreground mb-4">
              Show examples of excellent, acceptable, and unacceptable outputs. This calibrates the judge's standards.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">3. Scoring Guidelines</h3>
            <p className="text-muted-foreground mb-4">
              Specify how to translate qualitative assessment into quantitative scores (1-5 scale, pass/fail, etc.)
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Real-World Example: Customer Support Chatbot</h2>
            <p className="text-muted-foreground mb-4">
              Let's build a rubric for evaluating a SaaS support chatbot. We care about:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Accuracy: Does it provide correct information?</li>
              <li>Helpfulness: Does it solve the user's problem?</li>
              <li>Tone: Is it professional and empathetic?</li>
              <li>Safety: Does it avoid making promises we can't keep?</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h4 className="font-semibold mb-3">Sample Rubric:</h4>
              <div className="text-sm space-y-4">
                <div>
                  <p className="font-medium mb-1">Accuracy (1-5)</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><strong>5:</strong> All facts are correct and up-to-date</li>
                    <li><strong>3:</strong> Mostly correct but missing some details</li>
                    <li><strong>1:</strong> Contains factual errors or outdated information</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Helpfulness (1-5)</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><strong>5:</strong> Fully resolves the user's issue with clear next steps</li>
                    <li><strong>3:</strong> Points in the right direction but lacks detail</li>
                    <li><strong>1:</strong> Doesn't address the actual question</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Tone (Pass/Fail)</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><strong>Pass:</strong> Professional, empathetic, avoids jargon</li>
                    <li><strong>Fail:</strong> Rude, dismissive, overly technical, or unprofessional</li>
                  </ul>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Common Rubric Patterns</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">Semantic Similarity</h3>
            <p className="text-muted-foreground mb-4">
              For tasks with expected outputs (Q&A, classification), compare the model's response to 
              a reference answer:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
                "Compare the model output to the expected answer. Score 5 if semantically identical, 
                3 if mostly similar with minor differences, 1 if significantly different."
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">Fact Verification</h3>
            <p className="text-muted-foreground mb-4">
              For RAG and knowledge-based systems, verify claims against source documents:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
                "Check each factual claim in the output against the provided context. Mark as Pass 
                if all claims are supported, Fail if any claim is unsupported or contradicted."
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">Style Adherence</h3>
            <p className="text-muted-foreground mb-4">
              For content generation, ensure consistency with brand voice:
            </p>
            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <code className="text-sm">
                "Evaluate if the output matches our brand voice: conversational but professional, 
                uses 'we' not 'I', avoids corporate jargon. Provide specific examples of where 
                it succeeds or fails."
              </code>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Best Practices</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-3 mb-4">
              <li>
                <strong>Start with human labels:</strong> Have experts review 50-100 outputs and note what makes 
                them good or bad. This reveals what dimensions matter.
              </li>
              <li>
                <strong>Test inter-rater reliability:</strong> Run the same inputs through your LLM judge multiple 
                times. High variance means your rubric is ambiguous.
              </li>
              <li>
                <strong>Compare to human judgment:</strong> Calculate agreement rates between LLM judge scores and 
                human expert scores. Aim for 80%+ agreement.
              </li>
              <li>
                <strong>Iterate on disagreements:</strong> When the judge and human disagree, update the rubric 
                to clarify the edge case.
              </li>
              <li>
                <strong>Use chain-of-thought reasoning:</strong> Ask the judge to explain its reasoning before 
                scoring. This improves accuracy and debuggability.
              </li>
              <li>
                <strong>Separate dimensions:</strong> Break complex evaluations into multiple focused rubrics 
                rather than one catch-all criterion.
              </li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">Pitfalls to Avoid</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Rubrics that are too generic:</strong> "Is the response good?" doesn't provide enough guidance</li>
              <li><strong>Too many criteria:</strong> More than 5-6 dimensions overwhelms the judge and reduces accuracy</li>
              <li><strong>Lack of examples:</strong> Abstract criteria without concrete examples lead to inconsistent scoring</li>
              <li><strong>Not accounting for context:</strong> The same output might be good in one scenario and bad in another</li>
              <li><strong>Judging the judge:</strong> Using GPT-4 to judge GPT-4 can introduce model biases</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4 mt-8">When to Use (and Not Use) LLM Judges</h2>
            
            <p className="text-muted-foreground mb-4"><strong>✅ Great for:</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Semantic similarity and relevance</li>
              <li>Tone and style checks</li>
              <li>Fact-checking against provided context</li>
              <li>Detecting safety issues or harmful content</li>
              <li>Initial screening before human review</li>
            </ul>

            <p className="text-muted-foreground mb-4"><strong>❌ Not ideal for:</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Specialized domain knowledge (medical, legal)</li>
              <li>Highly subjective creative work</li>
              <li>When stakes are very high (use human review)</li>
              <li>Verifying facts without source context</li>
              <li>Real-time production decisions (too slow/expensive)</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Build Custom LLM Judge Rubrics</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our platform includes a rubric builder with templates for common use cases. Start evaluating 
                your AI outputs in minutes.
              </p>
              <Button asChild>
                <Link href="/guides/llm-judge">Learn More</Link>
              </Button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}