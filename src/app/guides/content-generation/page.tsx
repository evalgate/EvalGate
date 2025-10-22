import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"
import { ArrowLeft } from "lucide-react"

export default function ContentGenerationGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Content Generation Quality Control</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Ensure consistent tone, style, and accuracy when generating marketing copy or articles.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>15 min read</span>
            <span>•</span>
            <span>Use Cases</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <h2>The Challenge of AI-Generated Content</h2>
          <p>
            LLMs can generate content at scale, but quality varies dramatically. Without proper evaluation, 
            you risk publishing off-brand, inaccurate, or low-quality content that damages your reputation.
          </p>

          <h2>What to Evaluate</h2>

          <h3>1. Brand Voice Consistency</h3>
          <p>Does the content match your brand's tone and personality?</p>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <p className="mb-2"><strong>Brand: Professional B2B SaaS</strong></p>
            <p className="text-sm mb-2">✅ "Our platform helps enterprises streamline workflows"</p>
            <p className="text-sm mb-0">❌ "Check out this awesome tool that'll blow your mind!"</p>
          </div>

          <h3>2. Factual Accuracy</h3>
          <p>Are claims, statistics, and product details correct?</p>
          <ul>
            <li>Product features and pricing</li>
            <li>Industry statistics and research citations</li>
            <li>Company information and history</li>
            <li>Technical specifications</li>
          </ul>

          <h3>3. Writing Quality</h3>
          <ul>
            <li><strong>Grammar & spelling:</strong> Zero tolerance for errors</li>
            <li><strong>Clarity:</strong> Easy to understand for target audience</li>
            <li><strong>Structure:</strong> Logical flow with clear transitions</li>
            <li><strong>Engagement:</strong> Compelling and keeps readers interested</li>
          </ul>

          <h3>4. SEO & Formatting</h3>
          <ul>
            <li>Proper heading hierarchy (H1, H2, H3)</li>
            <li>Keyword usage (natural, not stuffed)</li>
            <li>Meta descriptions and titles</li>
            <li>Internal and external links</li>
          </ul>

          <h3>5. Originality</h3>
          <p>Content should be unique, not regurgitated from training data:</p>
          <ul>
            <li>Run plagiarism checks</li>
            <li>Verify unique insights and perspectives</li>
            <li>Ensure examples are fresh and relevant</li>
          </ul>

          <h2>Building Your Evaluation System</h2>

          <h3>Step 1: Define Your Brand Guidelines</h3>
          <p>Create a comprehensive style guide including:</p>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="font-semibold mb-2">Example Style Guide Excerpt:</p>
            <ul className="mb-0 space-y-1">
              <li><strong>Tone:</strong> Professional yet approachable</li>
              <li><strong>Voice:</strong> Active voice, second person ("you")</li>
              <li><strong>Vocabulary:</strong> Avoid jargon unless defining it</li>
              <li><strong>Sentence length:</strong> Average 15-20 words</li>
              <li><strong>Forbidden phrases:</strong> "Revolutionize," "game-changer," "leverage"</li>
            </ul>
          </div>

          <h3>Step 2: Create Reference Examples</h3>
          <p>Collect 20-30 examples of excellent content from your brand:</p>
          <ul>
            <li>Blog posts that performed well</li>
            <li>Marketing copy with high conversion</li>
            <li>Email campaigns with strong engagement</li>
          </ul>
          <p>Use these as gold standards for LLM judge training.</p>

          <h3>Step 3: Build a Custom LLM Judge</h3>
          <p>Create a rubric evaluating all quality dimensions:</p>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="font-semibold mb-2">Judge Prompt Template:</p>
            <p className="mb-0">
              "You are an expert content editor for [Brand]. Evaluate this generated content on: (1) Brand voice 
              alignment (1-5), (2) Factual accuracy (1-5), (3) Writing quality (1-5), (4) SEO optimization (1-5). 
              Our brand is [tone] and targets [audience]. Flag any claims that need fact-checking."
            </p>
          </div>

          <h3>Step 4: Add Automated Checks</h3>
          <p>Supplement LLM judges with deterministic tests:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Grammar check
const grammarErrors = await checkGrammar(content);
assert(grammarErrors.length === 0);

// Readability score
const flesch = calculateFleschScore(content);
assert(flesch >= 60); // Readable for general audience

// Forbidden phrases
const forbidden = ["game-changer", "revolutionize"];
forbidden.forEach(phrase => {
  assert(!content.toLowerCase().includes(phrase));
});

// Plagiarism check
const similarity = await checkPlagiarism(content);
assert(similarity < 0.15); // Less than 15% similar to existing content`}
          </div>

          <h2>Evaluation Workflow</h2>

          <h3>Pre-Publication Pipeline</h3>
          <ol>
            <li><strong>Generate:</strong> LLM creates first draft</li>
            <li><strong>Automated checks:</strong> Grammar, readability, plagiarism</li>
            <li><strong>LLM judge:</strong> Evaluates brand voice and quality</li>
            <li><strong>Fact verification:</strong> LLM judge flags claims to verify</li>
            <li><strong>Human review:</strong> Editor reviews flagged items</li>
            <li><strong>Revision:</strong> Regenerate or manually edit failures</li>
            <li><strong>Final approval:</strong> Re-evaluate revised content</li>
          </ol>

          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <p className="font-semibold mb-2">Example: Blog Post Generation</p>
            <p className="text-sm mb-1"><strong>Draft 1:</strong> Score 3.2/5 (weak brand voice, needs more examples)</p>
            <p className="text-sm mb-1"><strong>Revision prompt:</strong> "Rewrite in a more professional tone. Add 2 real-world examples."</p>
            <p className="text-sm mb-0"><strong>Draft 2:</strong> Score 4.5/5 (approved for publication)</p>
          </div>

          <h2>Content Type-Specific Considerations</h2>

          <h3>Blog Posts & Articles</h3>
          <ul>
            <li>Target length: 1,200-2,000 words</li>
            <li>Include actionable takeaways</li>
            <li>Add relevant examples and case studies</li>
            <li>Optimize for featured snippets</li>
          </ul>

          <h3>Product Descriptions</h3>
          <ul>
            <li>Highlight key features and benefits</li>
            <li>Include technical specifications</li>
            <li>Address common customer questions</li>
            <li>Maintain consistent formatting across products</li>
          </ul>

          <h3>Email Campaigns</h3>
          <ul>
            <li>Strong subject lines (test multiple variants)</li>
            <li>Clear call-to-action</li>
            <li>Personalization elements</li>
            <li>Mobile-friendly formatting</li>
          </ul>

          <h3>Social Media Copy</h3>
          <ul>
            <li>Platform-appropriate length and hashtags</li>
            <li>Engaging hooks in first line</li>
            <li>Brand-consistent emoji usage</li>
            <li>Clear link tracking</li>
          </ul>

          <h2>Common Failure Modes</h2>

          <h3>1. Generic, Uninspired Content</h3>
          <div className="bg-muted p-4 rounded-lg text-sm my-4">
            <p className="mb-2"><strong>Bad:</strong> "AI is transforming businesses across industries."</p>
            <p className="mb-0"><strong>Good:</strong> "Retail brands using AI for inventory forecasting reduced stockouts by 34% in Q4 2024."</p>
          </div>

          <h3>2. Off-Brand Tone</h3>
          <p>LLMs default to overly formal or generic corporate speak. Fine-tune prompts with brand voice examples.</p>

          <h3>3. Hallucinated Statistics</h3>
          <p>Always fact-check numbers and claims. Use RAG with verified data sources.</p>

          <h3>4. Keyword Stuffing</h3>
          <p>Avoid unnatural repetition of keywords. Aim for 1-2% keyword density.</p>

          <h2>Best Practices</h2>

          <h3>1. Use RAG for Factual Content</h3>
          <p>Ground generation in verified sources:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Retrieve verified product info
const productData = await vectorDB.search("product features", limit: 3);

// Generate with grounding
const content = await llm.generate({
  prompt: "Write a product description for...",
  context: productData,
  instruction: "Only use information from the provided context"
});`}
          </div>

          <h3>2. A/B Test Headlines and CTAs</h3>
          <p>Generate multiple variants and test with real users:</p>
          <ul>
            <li>Test 3-5 headline options</li>
            <li>Vary CTA wording and placement</li>
            <li>Track click-through and conversion rates</li>
          </ul>

          <h3>3. Maintain a Rejection Log</h3>
          <p>Track common failure patterns to improve prompts:</p>
          <ul>
            <li>What issues occur frequently?</li>
            <li>Which content types need most revision?</li>
            <li>Are failures decreasing over time?</li>
          </ul>

          <h3>4. Human-in-the-Loop for High-Stakes Content</h3>
          <p>Always have human review for:</p>
          <ul>
            <li>Legal or compliance-sensitive content</li>
            <li>Executive communications</li>
            <li>Press releases</li>
            <li>Content about sensitive topics</li>
          </ul>

          <h2>Measuring Content Performance</h2>
          <p>Track metrics to validate quality:</p>
          <ul>
            <li><strong>Engagement:</strong> Time on page, scroll depth</li>
            <li><strong>SEO:</strong> Keyword rankings, organic traffic</li>
            <li><strong>Conversion:</strong> Click-through rate, sign-ups</li>
            <li><strong>User feedback:</strong> Comments, shares, ratings</li>
          </ul>

          <h2>Real-World Example</h2>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">SaaS Marketing Blog</h3>
            <p><strong>Volume:</strong> 20 blog posts per month</p>
            <p><strong>Evaluation System:</strong></p>
            <ul>
              <li>Custom LLM judge trained on top-performing posts</li>
              <li>Automated grammar and plagiarism checks</li>
              <li>Human editor reviews 100% of flagged content</li>
            </ul>
            <p><strong>Results:</strong></p>
            <ul className="mb-0">
              <li>95% of generated content approved on first review</li>
              <li>40% reduction in editing time</li>
              <li>Maintained 4.2/5 reader satisfaction score</li>
              <li>30% increase in organic traffic over 6 months</li>
            </ul>
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
            <Link href="/guides/llm-judge" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Building Custom LLM Judge Rubrics</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Create brand-specific evaluators</div>
            </Link>
            <Link href="/guides/ab-testing" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
              <div className="font-semibold mb-1 text-sm sm:text-base">Running A/B Tests in Production</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Test content variants with users</div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}