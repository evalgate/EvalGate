import { db } from "@/db";
import { spans } from "@/db/schema";

async function main() {
  const sampleTraceSpans = [
    // Trace 1 (trace_001): API Request -> LLM Call -> Response Formatting
    {
      traceId: 1,
      spanId: "span_001",
      parentSpanId: null,
      name: "API Request",
      type: "function",
      input: 'POST /api/chat with body: { "message": "What is machine learning?" }',
      output: "Request validated and routed to LLM service",
      durationMs: 245,
      metadata: JSON.stringify({ endpoint: "/api/chat", method: "POST", statusCode: 200 }),
      createdAt: new Date("2024-01-15T10:00:00Z").toISOString(),
    },
    {
      traceId: 1,
      spanId: "span_002",
      parentSpanId: "span_001",
      name: "LLM Call",
      type: "llm",
      input: "User query: What is machine learning?",
      output:
        "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.",
      durationMs: 3420,
      metadata: JSON.stringify({ model: "gpt-4", tokens: 156, temperature: 0.7 }),
      createdAt: new Date("2024-01-15T10:00:00.245Z").toISOString(),
    },
    {
      traceId: 1,
      spanId: "span_003",
      parentSpanId: "span_002",
      name: "Response Formatting",
      type: "function",
      input: "Raw LLM output string",
      output: "JSON formatted response with metadata",
      durationMs: 125,
      metadata: JSON.stringify({ format: "json", includeMetadata: true }),
      createdAt: new Date("2024-01-15T10:00:03.665Z").toISOString(),
    },

    // Trace 2 (trace_002): Document Loading -> Text Processing -> Summary Generation
    {
      traceId: 2,
      spanId: "span_004",
      parentSpanId: null,
      name: "Document Loading",
      type: "tool",
      input: "document_id: doc_12345, source: s3://bucket/research-paper.pdf",
      output: "Document loaded successfully, 25 pages, 12,450 words",
      durationMs: 1850,
      metadata: JSON.stringify({ fileSize: "2.4MB", pages: 25 }),
      createdAt: new Date("2024-01-16T14:30:00Z").toISOString(),
    },
    {
      traceId: 2,
      spanId: "span_005",
      parentSpanId: "span_004",
      name: "Text Processing",
      type: "function",
      input: "Raw document text with formatting and special characters",
      output: "Cleaned text ready for summarization, 11,230 words after processing",
      durationMs: 890,
      metadata: JSON.stringify({ removedChars: 1220, cleanedSections: 8 }),
      createdAt: new Date("2024-01-16T14:30:01.850Z").toISOString(),
    },
    {
      traceId: 2,
      spanId: "span_006",
      parentSpanId: "span_005",
      name: "Summary Generation",
      type: "llm",
      input: "Cleaned document text for summarization",
      output:
        "This research paper explores novel approaches to neural network optimization, focusing on adaptive learning rates and gradient descent variations. Key findings include 23% improvement in convergence speed.",
      durationMs: 4560,
      metadata: JSON.stringify({ model: "gpt-4-turbo", originalLength: 11230, summaryLength: 187 }),
      createdAt: new Date("2024-01-16T14:30:02.740Z").toISOString(),
    },

    // Trace 3 (trace_003): Prompt Construction -> Code Generation
    {
      traceId: 3,
      spanId: "span_007",
      parentSpanId: null,
      name: "Prompt Construction",
      type: "function",
      input: "User request: Create a Python function to calculate Fibonacci sequence",
      output: "System prompt + user context + code generation instructions assembled",
      durationMs: 180,
      metadata: JSON.stringify({ language: "python", context: "fibonacci" }),
      createdAt: new Date("2024-01-17T09:15:00Z").toISOString(),
    },
    {
      traceId: 3,
      spanId: "span_008",
      parentSpanId: "span_007",
      name: "Code Generation",
      type: "llm",
      input: "Generate Python function for Fibonacci sequence with memoization",
      output:
        "def fibonacci(n, memo={}):\n    if n in memo:\n        return memo[n]\n    if n <= 1:\n        return n\n    memo[n] = fibonacci(n-1, memo) + fibonacci(n-2, memo)\n    return memo[n]",
      durationMs: 2340,
      metadata: JSON.stringify({ model: "gpt-4", language: "python", linesOfCode: 7 }),
      createdAt: new Date("2024-01-17T09:15:00.180Z").toISOString(),
    },

    // Trace 4 (trace_004): Text Preprocessing -> Model Inference
    {
      traceId: 4,
      spanId: "span_009",
      parentSpanId: null,
      name: "Text Preprocessing",
      type: "function",
      input: 'Raw customer review: "This product is absolutely amazing!!! Best purchase ever 😊"',
      output:
        'Preprocessed text: "this product is absolutely amazing best purchase ever", tokens: [2023, 4561, 8823, ...]',
      durationMs: 340,
      metadata: JSON.stringify({ originalLength: 61, processedLength: 52, tokensGenerated: 12 }),
      createdAt: new Date("2024-01-18T11:45:00Z").toISOString(),
    },
    {
      traceId: 4,
      spanId: "span_010",
      parentSpanId: "span_009",
      name: "Model Inference",
      type: "llm",
      input: "Tokenized review for sentiment analysis",
      output: "Sentiment: POSITIVE, Confidence: 0.96, Score: 4.8/5.0",
      durationMs: 1560,
      metadata: JSON.stringify({ model: "sentiment-bert-v2", confidence: 0.96 }),
      createdAt: new Date("2024-01-18T11:45:00.340Z").toISOString(),
    },

    // Trace 5 (trace_005): Source Text Loading -> Translation -> Post-processing
    {
      traceId: 5,
      spanId: "span_011",
      parentSpanId: null,
      name: "Source Text Loading",
      type: "tool",
      input: "Load text from file: translations/source/en/content.txt",
      output: "Text loaded: 450 words, 2,340 characters",
      durationMs: 420,
      metadata: JSON.stringify({ sourceLanguage: "en", wordCount: 450 }),
      createdAt: new Date("2024-01-19T16:20:00Z").toISOString(),
    },
    {
      traceId: 5,
      spanId: "span_012",
      parentSpanId: "span_011",
      name: "Translation",
      type: "llm",
      input:
        'English text: "Welcome to our platform. We provide innovative solutions for modern businesses."',
      output:
        'Spanish translation: "Bienvenido a nuestra plataforma. Proporcionamos soluciones innovadoras para empresas modernas."',
      durationMs: 2890,
      metadata: JSON.stringify({
        sourceLanguage: "en",
        targetLanguage: "es",
        model: "translation-v3",
      }),
      createdAt: new Date("2024-01-19T16:20:00.420Z").toISOString(),
    },
    {
      traceId: 5,
      spanId: "span_013",
      parentSpanId: "span_012",
      name: "Post-processing",
      type: "function",
      input: "Raw translation output",
      output: "Formatted translation with proper punctuation and capitalization",
      durationMs: 230,
      metadata: JSON.stringify({ corrections: 3, formatting: "applied" }),
      createdAt: new Date("2024-01-19T16:20:03.310Z").toISOString(),
    },

    // Trace 6 (trace_006): Request Validation -> API Call Failure
    {
      traceId: 6,
      spanId: "span_014",
      parentSpanId: null,
      name: "Request Validation",
      type: "function",
      input:
        'Validate API request parameters: { "api_key": "invalid_key_123", "endpoint": "/v1/completions" }',
      output: "Validation completed, proceeding with API call",
      durationMs: 95,
      metadata: JSON.stringify({ validationRules: 5, passed: 5 }),
      createdAt: new Date("2024-01-20T08:10:00Z").toISOString(),
    },
    {
      traceId: 6,
      spanId: "span_015",
      parentSpanId: "span_014",
      name: "API Call Failure",
      type: "tool",
      input: "Execute API call to external service",
      output: "Error: 401 Unauthorized - Invalid API key provided",
      durationMs: 650,
      metadata: JSON.stringify({
        statusCode: 401,
        errorType: "AuthenticationError",
        retryable: false,
      }),
      createdAt: new Date("2024-01-20T08:10:00.095Z").toISOString(),
    },

    // Trace 7 (trace_007): Data Loading -> Batch Processing -> Results Aggregation
    {
      traceId: 7,
      spanId: "span_016",
      parentSpanId: null,
      name: "Data Loading",
      type: "tool",
      input: "Load dataset from database: user_interactions_2024_q1",
      output: "Loaded 15,430 records for processing",
      durationMs: 2340,
      metadata: JSON.stringify({ recordCount: 15430, dataSize: "8.2MB" }),
      createdAt: new Date("2024-01-21T13:00:00Z").toISOString(),
    },
    {
      traceId: 7,
      spanId: "span_017",
      parentSpanId: "span_016",
      name: "Batch Processing",
      type: "llm",
      input: "Process 15,430 user interactions through classification model",
      output: "Classified interactions: 8,450 positive, 4,230 neutral, 2,750 negative",
      durationMs: 12450,
      metadata: JSON.stringify({ batchSize: 100, batches: 155, model: "classification-v2" }),
      createdAt: new Date("2024-01-21T13:00:02.340Z").toISOString(),
    },
    {
      traceId: 7,
      spanId: "span_018",
      parentSpanId: "span_017",
      name: "Results Aggregation",
      type: "function",
      input: "Aggregate classification results and generate statistics",
      output: "Summary report: 54.8% positive sentiment, average engagement score: 7.2/10",
      durationMs: 780,
      metadata: JSON.stringify({ metricsCalculated: 12, chartsGenerated: 5 }),
      createdAt: new Date("2024-01-21T13:00:14.790Z").toISOString(),
    },

    // Trace 8 (trace_008): Model Loading -> Inference
    {
      traceId: 8,
      spanId: "span_019",
      parentSpanId: null,
      name: "Model Loading",
      type: "tool",
      input: "Load model from cache: models/embeddings/text-embedding-ada-002",
      output: "Model loaded successfully into memory, ready for inference",
      durationMs: 1890,
      metadata: JSON.stringify({ modelSize: "350MB", cacheHit: true }),
      createdAt: new Date("2024-01-22T10:30:00Z").toISOString(),
    },
    {
      traceId: 8,
      spanId: "span_020",
      parentSpanId: "span_019",
      name: "Inference",
      type: "llm",
      input: 'Generate embeddings for text: "Machine learning transforms data into insights"',
      output: "Embedding vector generated: [0.023, -0.156, 0.089, ...] (1536 dimensions)",
      durationMs: 450,
      metadata: JSON.stringify({ dimensions: 1536, model: "text-embedding-ada-002" }),
      createdAt: new Date("2024-01-22T10:30:01.890Z").toISOString(),
    },
  ];

  await db.insert(spans).values(
    sampleTraceSpans.map((s) => ({
      ...s,
      startTime: s.createdAt,
      endTime: null,
    })),
  );

  console.log("✅ Trace spans seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
