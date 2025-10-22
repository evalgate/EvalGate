import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"
import { PublicPageHeader } from "@/components/public-page-header"

export default function LLMJudgeGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Building Custom LLM Judge Rubrics</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Create domain-specific evaluation criteria and train judge models for your use case.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>15 min read</span>
            <span>•</span>
            <span>Advanced Topics</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <h2>What is an LLM Judge?</h2>
          <p>
            An LLM judge is a powerful language model that evaluates outputs from your target AI system. 
            Instead of relying on expensive human reviewers or brittle regex patterns, judges use sophisticated 
            reasoning to assess quality across multiple dimensions.
          </p>

          <h2>When to Use LLM Judges</h2>
          <p>LLM judges excel at evaluating:</p>
          <ul>
            <li><strong>Open-ended generation:</strong> Essays, creative writing, summaries</li>
            <li><strong>Conversational AI:</strong> Helpfulness, tone, empathy in chat responses</li>
            <li><strong>Reasoning tasks:</strong> Logical coherence, factual accuracy</li>
            <li><strong>Multi-dimensional quality:</strong> Scoring outputs on 5+ criteria simultaneously</li>
          </ul>

          <h2>Anatomy of a Good Rubric</h2>
          <p>A rubric defines what the judge should evaluate and how. Strong rubrics include:</p>
          
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">1. Clear Evaluation Dimensions</h3>
            <p>Break down "quality" into specific, measurable criteria:</p>
            <ul className="mb-0">
              <li><strong>Accuracy:</strong> Is the information correct?</li>
              <li><strong>Relevance:</strong> Does it address the user's question?</li>
              <li><strong>Completeness:</strong> Are all aspects covered?</li>
              <li><strong>Clarity:</strong> Is it easy to understand?</li>
              <li><strong>Safety:</strong> Does it avoid harmful content?</li>
            </ul>
          </div>

          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">2. Scoring Scale</h3>
            <p>Define what each score means:</p>
            <ul className="mb-0">
              <li><strong>1:</strong> Completely fails the criterion</li>
              <li><strong>2:</strong> Partially meets the criterion with major issues</li>
              <li><strong>3:</strong> Meets the criterion with minor issues</li>
              <li><strong>4:</strong> Fully meets the criterion</li>
              <li><strong>5:</strong> Exceeds expectations</li>
            </ul>
          </div>

          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">3. Concrete Examples</h3>
            <p>Show the judge what good and bad look like:</p>
            <div className="bg-muted p-4 rounded mt-4">
              <p className="font-semibold mb-2">Example for "Clarity" (Score: 5/5)</p>
              <p className="text-sm mb-0">"To reset your password, click 'Forgot Password' on the login page, enter your email, and follow the link we send you."</p>
            </div>
            <div className="bg-muted p-4 rounded mt-4">
              <p className="font-semibold mb-2">Example for "Clarity" (Score: 2/5)</p>
              <p className="text-sm mb-0">"There's a thing you can do with the account settings or maybe the profile area to change your credentials."</p>
            </div>
          </div>

          <h2>Creating Your First Rubric</h2>
          <p>Navigate to the <Link href="/llm-judge" className="text-blue-500 hover:underline">LLM Judge</Link> page and click "Create New Rubric".</p>

          <h3>Step 1: Define Your Task</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
            <strong>Task:</strong> Evaluate customer support chatbot responses<br />
            <strong>Goal:</strong> Ensure responses are helpful, accurate, and empathetic
          </div>

          <h3>Step 2: Choose Evaluation Dimensions</h3>
          <p>For a customer support bot, you might evaluate:</p>
          <ul>
            <li>Helpfulness (1-5)</li>
            <li>Accuracy (1-5)</li>
            <li>Empathy (1-5)</li>
            <li>Conciseness (1-5)</li>
          </ul>

          <h3>Step 3: Write Detailed Instructions</h3>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="font-semibold mb-2">Example Judge Prompt:</p>
            <p className="mb-0">
              "You are an expert evaluator of customer support chatbot responses. Evaluate the following response 
              on four dimensions: Helpfulness, Accuracy, Empathy, and Conciseness. For each dimension, provide a 
              score from 1-5 and a brief justification. Consider that excellent support responses should directly 
              address the customer's issue, provide accurate information, show understanding of the customer's 
              frustration, and avoid unnecessary verbosity."
            </p>
          </div>

          <h3>Step 4: Add Few-Shot Examples</h3>
          <p>
            Include 3-5 example evaluations showing your judge how to score. This dramatically improves consistency 
            and alignment with your standards.
          </p>

          <h2>Training and Validating Judges</h2>
          <p>Before deploying a judge at scale:</p>
          
          <h3>1. Collect Human Ground Truth</h3>
          <p>
            Have human annotators evaluate 50-100 test cases. These ratings become your "gold standard" for 
            measuring judge performance.
          </p>

          <h3>2. Measure Judge Alignment</h3>
          <p>Run your judge on the same test cases and calculate:</p>
          <ul>
            <li><strong>Correlation:</strong> How closely do judge scores track human scores?</li>
            <li><strong>Agreement rate:</strong> What % of cases do judge and humans agree on?</li>
            <li><strong>Bias:</strong> Does the judge systematically over- or under-score?</li>
          </ul>
          <p>Our platform automatically computes these metrics on the Alignment Dashboard.</p>

          <h3>3. Iterate on the Rubric</h3>
          <p>If alignment is low (&lt;70% agreement), refine your rubric:</p>
          <ul>
            <li>Add more specific criteria definitions</li>
            <li>Include edge case examples</li>
            <li>Simplify scoring scales (3-point vs. 5-point)</li>
            <li>Use a more powerful judge model (GPT-4 over GPT-3.5)</li>
          </ul>

          <h2>Best Practices</h2>
          <ul>
            <li><strong>Use powerful models:</strong> GPT-4, Claude 3.5, or Gemini Pro make better judges</li>
            <li><strong>Keep rubrics focused:</strong> 3-5 dimensions is ideal; too many dilutes quality</li>
            <li><strong>Provide context:</strong> Give judges access to user intent, conversation history</li>
            <li><strong>Chain-of-thought reasoning:</strong> Ask judges to explain their scores</li>
            <li><strong>Calibrate regularly:</strong> Re-validate alignment when your task changes</li>
            <li><strong>Monitor drift:</strong> Track judge performance over time for consistency</li>
          </ul>

          <h2>Advanced Techniques</h2>

          <h3>Constitutional AI</h3>
          <p>
            Train judges to enforce specific values or policies (e.g., "never recommend medical advice" or 
            "always prioritize user privacy"). Embed these as hard constraints in your rubric.
          </p>

          <h3>Multi-Judge Consensus</h3>
          <p>
            Use 3-5 different judge models and aggregate their scores. This reduces individual model biases 
            and increases reliability.
          </p>

          <h3>Specialized Judges</h3>
          <p>
            Fine-tune smaller models on your domain for faster, cheaper evaluation. Our platform supports 
            custom model deployment.
          </p>

          <h2>Common Pitfalls</h2>
          <p><strong>Vague criteria:</strong> "Good quality" is not actionable. Be specific.</p>
          <p><strong>Anchor bias:</strong> Judges may favor responses similar to examples in the rubric.</p>
          <p><strong>Leniency bias:</strong> Some models tend to over-score; calibrate with human data.</p>
          <p><strong>Context blindness:</strong> Ensure judges have access to all relevant information.</p>

          <h2>Real-World Example</h2>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">Use Case: Technical Documentation Generator</h3>
            <p><strong>Dimensions:</strong></p>
            <ul>
              <li>Technical accuracy (1-5)</li>
              <li>Code correctness (1-5)</li>
              <li>Clarity for beginners (1-5)</li>
              <li>Completeness (1-5)</li>
            </ul>
            <p><strong>Result:</strong> Achieved 82% agreement with human reviewers, saving 20 hours/week of manual review.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-12">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/dashboard">Start Evaluating</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/guides">View All Guides</Link>
          </Button>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
          <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">Related Guides</h3>
          <div className="grid gap-3 sm:gap-4">
            <Link href="/guides/evaluation-types" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Understanding Evaluation Types</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Learn when to use different evaluation methods</div>
            </Link>
            <Link href="/guides/ab-testing" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Running A/B Tests in Production</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Test judge performance in real scenarios</div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}