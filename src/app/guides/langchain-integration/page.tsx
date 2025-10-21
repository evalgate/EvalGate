export const dynamic = 'force-static'
export const revalidate = false

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"

export default function LangChainIntegrationGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-base sm:text-xl font-bold">AI Evaluation Platform</Link>
            <Button asChild size="sm" className="h-9">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <Link href="/guides" className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Guides
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl font-bold">Integrating with LangChain</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Add evaluation and tracing to your LangChain applications with minimal code changes.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span>12 min read</span>
            <span>•</span>
            <span>Integrations</span>
          </div>
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none">
          <h2>Why Evaluate LangChain Applications?</h2>
          <p>
            LangChain makes it easy to build complex LLM applications, but that complexity creates more failure 
            points. Proper evaluation ensures your chains, agents, and RAG systems work reliably in production.
          </p>

          <h2>Installation</h2>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4">
            npm install @evalai/sdk langchain
          </div>

          <h2>Environment Setup</h2>
          <p>Add to your <code>.env</code> file:</p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`EVALAI_API_KEY=sk_test_your_api_key_here
EVALAI_ORGANIZATION_ID=your_org_id_here
OPENAI_API_KEY=your_openai_key`}
          </div>

          <h2>Basic Integration</h2>

          <h3>1. Initialize the SDK</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`import { AIEvalClient } from '@evalai/sdk'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { LLMChain } from 'langchain/chains'

// Initialize EvalAI client
const client = AIEvalClient.init()`}
          </div>

          <h3>2. Track LangChain Operations</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`// Create a trace for the chain execution
const trace = await client.traces.create({
  name: 'Summarization Chain',
  traceId: 'trace-' + Date.now(),
  metadata: { chainType: 'llm' }
})

// Run your LangChain chain
const llm = new ChatOpenAI({ temperature: 0.7 })
const chain = new LLMChain({ llm, prompt: promptTemplate })
const result = await chain.call({ input: 'Long article text...' })

// Add span for the chain execution
await client.traces.createSpan(trace.id, {
  name: 'LLMChain Execution',
  spanId: 'span-' + Date.now(),
  type: 'chain',
  startTime: new Date().toISOString(),
  input: 'Long article text...',
  output: result.text,
  metadata: { model: 'gpt-4' }
})`}
          </div>

          <h2>Tracing LangChain Components</h2>

          <h3>Simple Chains</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`import { LLMChain } from 'langchain/chains'

const chain = new LLMChain({ llm, prompt })

// Create trace for chain execution
const trace = await client.traces.create({
  name: 'Product Description Chain',
  traceId: 'chain-' + Date.now(),
  metadata: { productId: 'prod_123' }
})

const result = await chain.call({ product: 'laptop' })`}
          </div>

          <h3>Sequential Chains</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.chains import SequentialChain

# Define sub-chains
title_chain = LLMChain(llm=llm, prompt=title_prompt)
content_chain = LLMChain(llm=llm, prompt=content_prompt)

# Combine into sequential chain
overall_chain = SequentialChain(
    chains=[title_chain, content_chain],
    input_variables=["topic"],
    output_variables=["title", "content"]
)

# Trace with nested spans
with ai_eval.trace_context("blog-generation"):
    result = overall_chain({"topic": "AI evaluation"})`}
          </div>

          <h3>Agents</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.agents import initialize_agent, Tool
from langchain.agents import AgentType

# Define tools
tools = [
    Tool(name="Calculator", func=calculator.run, description="..."),
    Tool(name="Search", func=search.run, description="...")
]

# Initialize agent
agent = initialize_agent(
    tools, llm, agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION
)

# Trace agent execution (captures all tool calls)
@ai_eval.trace(name="research-agent")
def run_agent(query):
    return agent.run(query)

result = run_agent("What is the GDP of France?")`}
          </div>

          <h3>RAG Pipelines</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.chains import RetrievalQA
from langchain.vectorstores import Chroma

# Setup RAG chain
vectorstore = Chroma(embedding_function=embeddings)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever()
)

# Trace with retrieval metadata
@ai_eval.trace(name="documentation-qa")
def answer_question(question):
    # Trace will capture:
    # - Embedding generation
    # - Vector search
    # - Retrieved documents
    # - LLM generation
    return qa_chain.run(question)

answer = answer_question("How do I reset my password?")`}
          </div>

          <h2>Running Evaluations</h2>

          <h3>Create Test Cases</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`# Define test cases for your chain
test_cases = [
    {
        "input": {"topic": "machine learning"},
        "expected_output": None,  # Use LLM judge instead
        "metadata": {"category": "technical"}
    },
    {
        "input": {"topic": "cooking recipes"},
        "expected_output": None,
        "metadata": {"category": "lifestyle"}
    }
]

# Run evaluation
from ai_eval import Evaluation

eval_run = Evaluation.create(
    name="Blog Generation Quality",
    test_cases=test_cases,
    evaluator=llm_judge,  # Custom LLM judge
    target_function=run_chain
)

results = eval_run.execute()
print(f"Pass rate: {results.pass_rate}%")`}
          </div>

          <h3>LLM Judge for Chain Outputs</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`def llm_judge(input_data, output_data, expected=None):
    """Custom evaluator for chain quality."""
    prompt = f"""
    Evaluate this blog post on quality (1-5):
    
    Topic: {input_data['topic']}
    Generated: {output_data}
    
    Score on:
    1. Relevance to topic
    2. Writing quality
    3. Engaging content
    
    Return JSON: {{"score": X, "reasoning": "..."}}
    """
    
    judgment = evaluation_llm.predict(prompt)
    return parse_judgment(judgment)

# Use in evaluation
eval_run = Evaluation.create(
    name="Chain Quality Check",
    test_cases=test_cases,
    evaluator=llm_judge,
    target_function=run_chain
)`}
          </div>

          <h2>Monitoring Production Chains</h2>

          <h3>Add Metadata for Debugging</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`@ai_eval.trace(
    name="customer-support-chain",
    metadata={
        "user_id": user_id,
        "session_id": session_id,
        "intent": detected_intent,
        "context_length": len(conversation_history)
    }
)
def handle_customer_query(query, history):
    return support_chain.run(
        query=query,
        history=history
    )`}
          </div>

          <h3>Track Chain Performance</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`# Automatically tracked by tracing:
# - Total latency
# - Token usage per LLM call
# - Number of steps/tool invocations
# - Errors and failures

# View in dashboard:
# Navigate to /traces and filter by "customer-support-chain"`}
          </div>

          <h3>Set Up Alerts</h3>
          <ul>
            <li><strong>High latency:</strong> Alert if chain takes &gt;5s</li>
            <li><strong>Error spike:</strong> Alert if error rate &gt;5%</li>
            <li><strong>Token budget:</strong> Alert if daily tokens exceed threshold</li>
          </ul>

          <h2>Common LangChain Patterns</h2>

          <h3>Memory-Enabled Chains</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory()
conversation = ConversationChain(llm=llm, memory=memory)

@ai_eval.trace(
    name="conversation",
    metadata={"session_id": session_id}
)
def chat(message):
    # Memory state captured in trace
    return conversation.predict(input=message)

# Multi-turn conversation tracking
chat("Hello!")
chat("What's the weather?")
chat("Thanks!")  # Full conversation visible in trace`}
          </div>

          <h3>Custom Chains</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.chains.base import Chain

class MyCustomChain(Chain):
    @property
    def input_keys(self):
        return ["input"]
    
    @property
    def output_keys(self):
        return ["output"]
    
    def _call(self, inputs):
        # Trace internal steps
        with ai_eval.span(name="step-1"):
            result1 = self.step1(inputs)
        
        with ai_eval.span(name="step-2"):
            result2 = self.step2(result1)
        
        return {"output": result2}

# Use as normal
custom_chain = MyCustomChain()
result = ai_eval.trace(name="custom-chain")(custom_chain)({"input": "..."})`}
          </div>

          <h2>Best Practices</h2>

          <h3>1. Trace at the Right Level</h3>
          <ul>
            <li><strong>High level:</strong> Trace entire chain for end-to-end monitoring</li>
            <li><strong>Mid level:</strong> Add spans for key steps (retrieval, tool calls)</li>
            <li><strong>Low level:</strong> Trace individual LLM calls for debugging</li>
          </ul>

          <h3>2. Include Context in Metadata</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`# Good metadata
metadata = {
    "user_id": "user_123",
    "chain_type": "qa",
    "retriever_top_k": 5,
    "llm_temperature": 0.7,
    "input_length": len(query)
}

# Use for filtering and debugging in dashboard`}
          </div>

          <h3>3. Monitor Chain Drift</h3>
          <p>Track quality over time to detect degradation:</p>
          <ul>
            <li>Run weekly evaluations on fixed test suite</li>
            <li>Compare pass rates across model versions</li>
            <li>Alert on significant quality drops</li>
          </ul>

          <h3>4. Use Callbacks for Custom Tracking</h3>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto">
{`from langchain.callbacks.base import BaseCallbackHandler

class EvalCallbackHandler(BaseCallbackHandler):
    def on_chain_start(self, serialized, inputs, **kwargs):
        ai_eval.start_trace("chain", metadata={"inputs": inputs})
    
    def on_chain_end(self, outputs, **kwargs):
        ai_eval.end_trace(metadata={"outputs": outputs})

# Use with chains
chain.run("...", callbacks=[EvalCallbackHandler()])`}
          </div>

          <h2>Troubleshooting</h2>

          <p><strong>Traces not appearing?</strong></p>
          <p>Ensure SDK is initialized with correct API key and the trace decorator is applied.</p>

          <p><strong>Missing nested spans?</strong></p>
          <p>Use context managers (`with ai_eval.span(...)`) for manual span creation in custom chains.</p>

          <p><strong>High overhead?</strong></p>
          <p>Sample traces (e.g., trace 10% of requests) for high-throughput applications.</p>

          <h2>Real-World Example</h2>
          <div className="bg-card border border-border p-6 rounded-lg my-6">
            <h3 className="mt-0">Customer Support Agent</h3>
            <p><strong>Setup:</strong> LangChain agent with 5 tools (search, database, calculator, email, escalation)</p>
            <p><strong>Evaluation:</strong></p>
            <ul>
              <li>50 test cases covering common support queries</li>
              <li>LLM judge evaluates helpfulness and accuracy</li>
              <li>Automated checks for escalation logic</li>
            </ul>
            <p><strong>Results:</strong></p>
            <ul className="mb-0">
              <li>92% of queries resolved without human intervention</li>
              <li>Average response time: 2.3s</li>
              <li>Detected and fixed 3 tool selection bugs pre-production</li>
            </ul>
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
              <Link href="/guides/tracing-setup" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1 text-sm sm:text-base">Setting Up Tracing in Your Application</div>
                <div className="text-xs sm:text-sm text-muted-foreground">General tracing concepts</div>
              </Link>
              <Link href="/guides/rag-evaluation" className="block p-4 sm:p-5 border border-border rounded-lg hover:border-blue-500 transition-colors">
                <div className="font-semibold mb-1 text-sm sm:text-base">RAG System Evaluation</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Evaluate LangChain RAG chains</div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}