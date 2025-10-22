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
              Best Practices
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Human-in-the-Loop: When to Use Annotations vs LLM Judges</h1>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>October 13, 2025</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>11 min read</span>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              A practical framework for deciding between human review and automated evaluation at scale. 
              Learn when to invest in human annotations and when LLM judges are sufficient.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">The Trade-Off</h2>
            <p className="text-muted-foreground mb-4">
              Every AI team faces this dilemma: human evaluation is accurate but slow and expensive. Automated 
              evaluation (LLM judges) is fast and cheap but less reliable. How do you decide which to use?
            </p>
            <p className="text-muted-foreground mb-4">
              The answer isn't binary. Most successful AI products use a hybrid approach—humans and automation 
              working together, each handling what they're best at.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Understanding the Approaches</h2>

            <h3 className="text-xl font-semibold mb-3 mt-6">Human Annotations</h3>
            <p className="text-muted-foreground mb-4">
              Domain experts review AI outputs and label them according to quality criteria:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>Accuracy:</strong> Is the information correct?</li>
              <li><strong>Helpfulness:</strong> Does it address the user's need?</li>
              <li><strong>Appropriateness:</strong> Is the tone and style suitable?</li>
              <li><strong>Safety:</strong> Any harmful or biased content?</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm"><strong>Pros:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground ml-4 mt-2">
                <li>✅ Gold standard accuracy</li>
                <li>✅ Captures nuance and edge cases</li>
                <li>✅ Can evaluate subjective criteria</li>
                <li>✅ Identifies patterns you didn't anticipate</li>
              </ul>
              <p className="text-sm mt-3"><strong>Cons:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground ml-4 mt-2">
                <li>❌ Expensive ($5-50 per review depending on complexity)</li>
                <li>❌ Slow (hours to days for results)</li>
                <li>❌ Doesn't scale (100 reviews/day is a lot)</li>
                <li>❌ Requires training and quality control</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">LLM Judges</h3>
            <p className="text-muted-foreground mb-4">
              Use a strong LLM (GPT-4, Claude-3.5) to automatically evaluate outputs based on defined rubrics:
            </p>

            <div className="rounded-lg border border-border bg-card p-4 mb-4">
              <p className="text-sm"><strong>Pros:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground ml-4 mt-2">
                <li>✅ Fast (seconds per review)</li>
                <li>✅ Cheap ($0.01-0.10 per review)</li>
                <li>✅ Scales to millions of reviews</li>
                <li>✅ Consistent scoring criteria</li>
              </ul>
              <p className="text-sm mt-3"><strong>Cons:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground ml-4 mt-2">
                <li>❌ Can miss subtle issues</li>
                <li>❌ Has biases (length, position, self-preference)</li>
                <li>❌ Struggles with specialized domains</li>
                <li>❌ Requires well-designed rubrics</li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Decision Framework</h2>
            <p className="text-muted-foreground mb-4">
              Use this decision tree to determine the right approach for your use case:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Use Human Annotations When:</h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-3 mb-6">
              <li>
                <strong>Establishing ground truth</strong>
                <p className="text-sm mt-1">Building your initial test set or training data for an LLM judge? 
                Humans provide the gold standard that everything else is validated against.</p>
              </li>
              <li>
                <strong>High stakes or regulated domains</strong>
                <p className="text-sm mt-1">Medical advice, legal documents, financial recommendations—when 
                errors have serious consequences, human review is non-negotiable.</p>
              </li>
              <li>
                <strong>Specialized domain expertise required</strong>
                <p className="text-sm mt-1">If it takes years of training to evaluate quality (medical diagnosis, 
                legal briefs, scientific papers), general-purpose LLMs aren't qualified.</p>
              </li>
              <li>
                <strong>Subjective or creative work</strong>
                <p className="text-sm mt-1">Marketing copy, product descriptions, creative writing—when 
                "quality" depends on brand voice and subjective judgment.</p>
              </li>
              <li>
                <strong>Edge case investigation</strong>
                <p className="text-sm mt-1">When automated systems flag unusual outputs, humans can determine 
                if it's a real issue or false positive.</p>
              </li>
              <li>
                <strong>Calibrating LLM judges</strong>
                <p className="text-sm mt-1">Use human annotations to measure how well your LLM judge correlates 
                with expert judgment.</p>
              </li>
            </ol>

            <h3 className="text-xl font-semibold mb-3 mt-6">Use LLM Judges When:</h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-3 mb-6">
              <li>
                <strong>Scaling evaluation</strong>
                <p className="text-sm mt-1">Need to evaluate thousands of outputs? LLM judges can process your 
                entire test set in minutes.</p>
              </li>
              <li>
                <strong>Continuous monitoring</strong>
                <p className="text-sm mt-1">Running evals on every production request. Humans can't review 
                10,000 outputs per day.</p>
              </li>
              <li>
                <strong>Pre-screening before human review</strong>
                <p className="text-sm mt-1">Use LLM judges to flag potentially problematic outputs, then have 
                humans review only those flagged cases.</p>
              </li>
              <li>
                <strong>Well-defined quality criteria</strong>
                <p className="text-sm mt-1">When "good" can be clearly articulated (factual accuracy, semantic 
                similarity, tone adherence), LLMs excel.</p>
              </li>
              <li>
                <strong>Comparative evaluation</strong>
                <p className="text-sm mt-1">Comparing outputs from two models or prompts. LLMs can make 
                pairwise comparisons consistently.</p>
              </li>
              <li>
                <strong>Development iteration</strong>
                <p className="text-sm mt-1">During rapid prototyping, LLM judges give fast feedback on changes 
                without waiting for human review.</p>
              </li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">Hybrid Approaches</h2>
            <p className="text-muted-foreground mb-4">
              The most effective strategy combines both methods:
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Pattern 1: Human Ground Truth → Automated Scale</h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Have domain experts annotate 100-500 examples</li>
              <li>Build an LLM judge rubric based on patterns from human annotations</li>
              <li>Validate LLM judge scores against human scores (aim for 80%+ agreement)</li>
              <li>Use LLM judge for all future evaluations at scale</li>
              <li>Periodically sample LLM judge outputs for human audit</li>
            </ol>

            <h3 className="text-xl font-semibold mb-3 mt-6">Pattern 2: Automated Screening → Human Triage</h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>LLM judge evaluates all production outputs</li>
              <li>Automatically flags outputs below quality threshold</li>
              <li>Humans review only flagged cases (5-10% of total)</li>
              <li>Human feedback updates the flagging criteria</li>
            </ol>

            <h3 className="text-xl font-semibold mb-3 mt-6">Pattern 3: Confidence-Based Routing</h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-4">
              <li>LLM judge provides scores + confidence estimates</li>
              <li>High confidence cases: Automated approval/rejection</li>
              <li>Low confidence cases: Route to human review</li>
              <li>Reduces human workload by 70-90% while maintaining quality</li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">Real-World Examples</h2>

            <div className="space-y-6 mb-6">
              <div className="rounded-lg border border-border bg-card p-5">
                <p className="font-medium mb-2">🏥 Medical Chatbot (Healthcare SaaS)</p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Approach:</strong> Hybrid with human final approval
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• LLM judge screens for obvious safety issues (suggesting self-diagnosis, recommending prescription changes)</li>
                  <li>• Flags 15% of responses for human review</li>
                  <li>• Medical professionals review flagged cases within 2 hours</li>
                  <li>• Cost: $0.02 automated + $3.50 human review (amortized) = $0.55 per interaction</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <p className="font-medium mb-2">💼 Content Generation (Marketing Agency)</p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Approach:</strong> LLM judge with periodic human calibration
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• LLM judge evaluates all generated content for brand voice, tone, grammar</li>
                  <li>• 93% agreement with human experts (validated on 500 examples)</li>
                  <li>• Senior copywriters review 50 random samples weekly to catch drift</li>
                  <li>• Cost: $0.05 per evaluation vs. $25 for human review</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <p className="font-medium mb-2">🎓 Educational Tutoring (EdTech Startup)</p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Approach:</strong> Human ground truth → automated scale
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Educators annotated 300 tutor responses across subjects</li>
                  <li>• Built LLM judge rubric based on educator feedback</li>
                  <li>• Now evaluates 10,000 interactions/day automatically</li>
                  <li>• Quarterly re-calibration with fresh human annotations</li>
                </ul>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4 mt-8">Cost Comparison</h2>
            <p className="text-muted-foreground mb-4">
              Let's say you need to evaluate 10,000 AI outputs per month:
            </p>

            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">100% Human Annotation</p>
                  <p className="text-sm text-muted-foreground">
                    10,000 reviews × $10/review = <strong>$100,000/month</strong>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">100% LLM Judge</p>
                  <p className="text-sm text-muted-foreground">
                    10,000 reviews × $0.05/review = <strong>$500/month</strong>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hybrid (10% Human Review)</p>
                  <p className="text-sm text-muted-foreground">
                    9,000 LLM reviews ($450) + 1,000 human reviews ($10,000) = <strong>$10,450/month</strong>
                  </p>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              The hybrid approach gives you 99% cost savings vs. full human review while maintaining high quality 
              through selective human oversight.
            </p>

            <h2 className="text-2xl font-bold mb-4 mt-8">Best Practices</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-3 mb-4">
              <li><strong>Start with humans:</strong> Build ground truth before automating</li>
              <li><strong>Measure agreement:</strong> Track human-LLM correlation over time</li>
              <li><strong>Version your rubrics:</strong> Document changes to evaluation criteria</li>
              <li><strong>Catch drift early:</strong> Regularly sample LLM judge outputs for human audit</li>
              <li><strong>Invest in tooling:</strong> Good annotation interfaces improve quality and speed</li>
              <li><strong>Train your annotators:</strong> Clear guidelines and examples reduce variance</li>
            </ol>

            <h2 className="text-2xl font-bold mb-4 mt-8">When in Doubt</h2>
            <p className="text-muted-foreground mb-4">
              If you're unsure whether to use human annotations or LLM judges, ask:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong>"What's the cost of a mistake?"</strong> High stakes → humans. Low stakes → automation.</li>
              <li><strong>"Can I clearly define 'good'?"</strong> Yes → LLM judge. No → humans.</li>
              <li><strong>"How many reviews do I need?"</strong> Hundreds → humans. Thousands+ → automation.</li>
              <li><strong>"Do I have domain experts?"</strong> No → you probably can't evaluate properly yet.</li>
            </ul>

            <div className="rounded-lg border border-border bg-card p-6 mt-8">
              <h3 className="text-lg font-semibold mb-3">Build Your Evaluation Workflow</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our platform supports both human annotations and LLM judges, with built-in agreement tracking 
                and hybrid workflows. Start with our annotation guide.
              </p>
              <Button asChild>
                <Link href="/documentation">Learn More</Link>
              </Button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}