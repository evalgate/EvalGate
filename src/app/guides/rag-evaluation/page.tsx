import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { PublicPageHeader } from "@/components/public-page-header"

import Link from "next/link"
import { ArrowLeft, Search, FileText, CheckCircle2 } from "lucide-react"

export default function RAGEvaluationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicPageHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
          <Button variant="ghost" asChild className="mb-4 sm:mb-6">
            <Link href="/guides">
              <ArrowLeft className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back to Guides
            </Link>
          </Button>

          <div className="mb-8 sm:mb-12">
            <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">RAG Evaluation Guide</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Learn how to evaluate Retrieval-Augmented Generation systems for accuracy and relevance.
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>What is RAG?</h2>
            <p>
              Retrieval-Augmented Generation (RAG) combines information retrieval with LLM generation. Instead of 
              relying solely on the model's training data, RAG systems retrieve relevant documents from a knowledge 
              base and use them as context for generating responses.
            </p>

            <h2>Why RAG Evaluation is Challenging</h2>
            <p>RAG systems have multiple failure points:</p>
            <ul>
              <li><strong>Retrieval:</strong> Did we find the right documents?</li>
              <li><strong>Relevance:</strong> Is the retrieved context useful?</li>
              <li><strong>Generation:</strong> Did the LLM use the context correctly?</li>
              <li><strong>Grounding:</strong> Is the answer supported by retrieved docs?</li>
            </ul>
            <p>Each component must be evaluated separately and holistically.</p>

            <h2>Evaluation Framework</h2>

            <h3>1. Retrieval Quality</h3>
            <p>Are you retrieving the right documents?</p>

            <h4>Metrics:</h4>
            <ul>
              <li><strong>Precision@K:</strong> Of the top K retrieved docs, how many are relevant?</li>
              <li><strong>Recall@K:</strong> Of all relevant docs, how many are in top K?</li>
              <li><strong>MRR (Mean Reciprocal Rank):</strong> Position of first relevant document</li>
              <li><strong>NDCG (Normalized Discounted Cumulative Gain):</strong> Quality of ranking</li>
            </ul>

            <h4>Evaluation Method:</h4>
            <div className="bg-muted p-4 rounded-lg text-sm my-4">
              <p className="mb-2"><strong>Test Case:</strong></p>
              <p className="mb-1">Query: "What is our refund policy for damaged items?"</p>
              <p className="mb-1">Gold Standard: [doc_42, doc_87, doc_103]</p>
              <p className="mb-1">Retrieved: [doc_42, doc_91, doc_103, doc_45, doc_87]</p>
              <p className="mb-0">Precision@3: 2/3 = 67% | Recall@5: 3/3 = 100%</p>
            </div>

            <h3>2. Context Relevance</h3>
            <p>Is the retrieved context actually useful for answering the query?</p>

            <h4>Metrics:</h4>
            <ul>
              <li><strong>Context Relevance Score:</strong> LLM judges if context helps answer the query (1-5)</li>
              <li><strong>Context Precision:</strong> % of retrieved chunks that are relevant</li>
            </ul>

            <h4>LLM Judge Prompt:</h4>
            <div className="bg-muted p-4 rounded-lg text-sm my-4">
              <p className="mb-0">
                "Given this query: [QUERY] and retrieved context: [CONTEXT], rate how relevant this context is for 
                answering the query on a scale of 1-5. A score of 5 means the context directly answers the query. 
                A score of 1 means the context is completely irrelevant."
              </p>
            </div>

            <h3>3. Answer Faithfulness</h3>
            <p>Is the generated answer grounded in the retrieved context, or is it hallucinating?</p>

            <h4>Metrics:</h4>
            <ul>
              <li><strong>Faithfulness Score:</strong> % of claims in answer supported by context</li>
              <li><strong>Citation Coverage:</strong> Are all facts attributed to sources?</li>
            </ul>

            <h4>Evaluation Approach:</h4>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Use LLM to extract claims from answer
const claims = await extractClaims(answer);

// Check each claim against retrieved context
const supported = await Promise.all(
  claims.map(claim => isSupported(claim, context))
);

const faithfulness = supported.filter(Boolean).length / claims.length;
assert(faithfulness >= 0.95); // 95%+ claims must be supported`}
            </div>

            <h3>4. Answer Relevance</h3>
            <p>Does the answer actually address the user's query?</p>

            <h4>Example:</h4>
            <div className="bg-card border border-border p-6 rounded-lg my-6">
              <p className="text-sm mb-2"><strong>Query:</strong> "How long does shipping take?"</p>
              <p className="text-sm mb-2"><strong>Bad (not relevant):</strong> "We offer free shipping on orders over $50."</p>
              <p className="text-sm mb-0"><strong>Good:</strong> "Standard shipping takes 5-7 business days."</p>
            </div>

            <h3>5. Answer Correctness</h3>
            <p>Is the answer factually accurate compared to ground truth?</p>

            <h4>Methods:</h4>
            <ul>
              <li><strong>Exact match:</strong> For factual queries (dates, numbers)</li>
              <li><strong>Semantic similarity:</strong> Compare to reference answer</li>
              <li><strong>LLM-as-judge:</strong> Evaluate correctness holistically</li>
            </ul>

            <h2>Building a RAG Test Suite</h2>

            <h3>Step 1: Create Query-Answer Pairs</h3>
            <p>Collect 100-200 representative queries with gold-standard answers:</p>
            <div className="bg-muted p-4 rounded-lg text-sm my-4">
              <p className="font-semibold mb-2">Example Test Case:</p>
              <p className="text-sm mb-1"><strong>Query:</strong> "What is the maximum file size for uploads?"</p>
              <p className="text-sm mb-1"><strong>Expected Answer:</strong> "The maximum file size is 100MB per file"</p>
              <p className="text-sm mb-1"><strong>Relevant Docs:</strong> ["docs/upload-limits.md", "docs/faq.md"]</p>
              <p className="text-sm mb-0"><strong>Category:</strong> Technical specs</p>
            </div>

            <h3>Step 2: Test Retrieval Separately</h3>
            <p>Before evaluating end-to-end, isolate retrieval:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Test just the retrieval step
const retrieved = await vectorDB.search(query, k=5);

// Check if relevant docs were retrieved
const relevantDocs = ["docs/upload-limits.md", "docs/faq.md"];
const precision = retrieved.filter(doc => 
  relevantDocs.includes(doc.id)
).length / 5;

console.log(\`Precision@5: \${precision * 100}%\`);`}
            </div>

            <h3>Step 3: Evaluate End-to-End</h3>
            <p>Run full RAG pipeline and check all quality dimensions:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`const result = await ragPipeline.query("What is the max file size?");

// Check retrieval quality
assert(result.retrievedDocs.some(doc => doc.id === "docs/upload-limits.md"));

// Check answer correctness
const correctness = await llmJudge.evaluate(result.answer, expectedAnswer);
assert(correctness >= 4); // 4/5 or better

// Check faithfulness
const faithfulness = await checkFaithfulness(result.answer, result.context);
assert(faithfulness >= 0.95);`}
            </div>

            <h2>Common Failure Modes</h2>

            <h3>1. Retrieval Failures</h3>
            <div className="bg-card border border-border p-4 rounded-lg my-6">
              <p className="text-sm mb-2"><strong>Problem:</strong> Query uses different terminology than documents</p>
              <p className="text-sm mb-2"><strong>Query:</strong> "How do I reset my password?"</p>
              <p className="text-sm mb-2"><strong>Documents use:</strong> "password recovery" not "reset"</p>
              <p className="text-sm mb-0"><strong>Solution:</strong> Query expansion, synonyms, hybrid search (keyword + semantic)</p>
            </div>

            <h3>2. Context Window Overflow</h3>
            <p>Retrieved too many docs, exceeded LLM context limit.</p>
            <p><strong>Solution:</strong> Rerank and truncate to most relevant chunks.</p>

            <h3>3. Answer Hallucination</h3>
            <div className="bg-muted p-4 rounded-lg text-sm my-4">
              <p className="mb-2"><strong>Context:</strong> "Our support team responds within 24 hours on weekdays."</p>
              <p className="mb-2"><strong>Bad Answer:</strong> "Support responds within 24 hours, including weekends."</p>
              <p className="mb-0"><strong>Issue:</strong> LLM added information not in context</p>
            </div>
            <p><strong>Solution:</strong> Add instruction: "Only use information from the provided context. If unsure, say so."</p>

            <h3>4. Incomplete Answers</h3>
            <p>Relevant information was retrieved but not included in answer.</p>
            <p><strong>Solution:</strong> Improve generation prompt to cover all relevant points from context.</p>

            <h2>Advanced Techniques</h2>

            <h3>1. Hybrid Search</h3>
            <p>Combine semantic search with keyword matching:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Semantic search results
const semanticResults = await vectorDB.search(embedding, k=10);

// Keyword search results
const keywordResults = await fullTextSearch(query, k=10);

// Combine with learned weights
const combined = reciprocalRankFusion(semanticResults, keywordResults);`}
            </div>

            <h3>2. Reranking</h3>
            <p>After initial retrieval, use a reranker to improve ordering:</p>
            <ul>
              <li>Cross-encoder models (BERT-based)</li>
              <li>LLM-as-reranker</li>
              <li>Learned-to-rank models</li>
            </ul>

            <h3>3. Query Rewriting</h3>
            <p>Transform user queries into better search queries:</p>
            <div className="bg-muted p-4 rounded-lg text-sm my-4">
              <p className="mb-1"><strong>Original:</strong> "How do I do that thing with the files?"</p>
              <p className="mb-0"><strong>Rewritten:</strong> "How to upload files? What is the file size limit?"</p>
            </div>

            <h3>4. Multi-Hop Retrieval</h3>
            <p>For complex queries, retrieve iteratively:</p>
            <ol>
              <li>Retrieve documents answering first part of query</li>
              <li>Use those results to refine query for second retrieval</li>
              <li>Combine information from both retrievals</li>
            </ol>

            <h2>Monitoring Production RAG</h2>
            <p>Track these metrics continuously:</p>
            <ul>
              <li><strong>Answer rate:</strong> % of queries answered vs. "I don't know"</li>
              <li><strong>User feedback:</strong> Thumbs up/down on answers</li>
              <li><strong>Retrieval latency:</strong> Time to fetch documents</li>
              <li><strong>Generation latency:</strong> Time to generate answer</li>
              <li><strong>Context usage:</strong> Are retrieved docs actually being used?</li>
            </ul>

            <h2>Optimization Strategies</h2>

            <h3>Improve Retrieval</h3>
            <ul>
              <li>Fine-tune embedding models on your domain</li>
              <li>Increase chunk overlap to avoid splitting related information</li>
              <li>Add metadata filters (date, category, author)</li>
              <li>Use better chunking strategies (semantic, sentence-based)</li>
            </ul>

            <h3>Improve Generation</h3>
            <ul>
              <li>Provide clear instructions about using context</li>
              <li>Include examples of good citations</li>
              <li>Use chain-of-thought to explain reasoning</li>
              <li>Add explicit "Don't hallucinate" instructions</li>
            </ul>

            <h2>Real-World Example</h2>
            <div className="bg-card border border-border p-6 rounded-lg my-6">
              <h3 className="mt-0">Technical Documentation Q&A</h3>
              <p><strong>Knowledge Base:</strong> 500 documents, 10,000 chunks</p>
              <p><strong>Test Suite:</strong> 150 queries</p>
              <p><strong>Initial Performance:</strong></p>
              <ul>
                <li>Precision@3: 58%</li>
                <li>Faithfulness: 82%</li>
                <li>Answer correctness: 3.2/5</li>
              </ul>
              <p><strong>After Optimization:</strong></p>
              <ul>
                <li>Added hybrid search + reranking</li>
                <li>Fine-tuned retriever on domain data</li>
                <li>Improved generation prompts with examples</li>
              </ul>
              <p><strong>Final Performance:</strong></p>
              <ul className="mb-0">
                <li>Precision@3: 84% (+26pp)</li>
                <li>Faithfulness: 96% (+14pp)</li>
                <li>Answer correctness: 4.3/5 (+1.1 points)</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <h3 className="font-semibold mb-4">Related Guides</h3>
            <div className="grid gap-4">
              <Link href="/guides/llm-judge" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">Building Custom LLM Judge Rubrics</div>
                <div className="text-sm text-muted-foreground">Automate faithfulness evaluation</div>
              </Link>
              <Link href="/guides/token-optimization" className="block p-4 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1">Optimizing Token Usage and Latency</div>
                <div className="text-sm text-muted-foreground">Reduce RAG system costs</div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}