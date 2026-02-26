import { db } from "@/db";
import { llmJudgeResults } from "@/db/schema";

async function main() {
  const sampleLlmJudgeResults = [
    {
      configId: 1,
      input: "What are the key principles of object-oriented programming?",
      output:
        "The key principles of object-oriented programming (OOP) are: 1) Encapsulation - bundling data and methods that operate on that data within a single unit or class, 2) Inheritance - allowing classes to inherit properties and methods from parent classes, 3) Polymorphism - enabling objects to take multiple forms and respond differently to the same message, and 4) Abstraction - hiding complex implementation details and showing only necessary features.",
      score: 95,
      reasoning:
        "The response accurately covers all four fundamental OOP principles with clear explanations. Each principle is well-defined and the answer is comprehensive. The structure is logical and easy to understand. Minor deduction for not providing practical examples to illustrate each concept.",
      metadata: { evaluationTime: 1247, modelVersion: "gpt-4" },
      createdAt: new Date("2024-01-15T10:30:00"),
    },
    {
      configId: 1,
      input: "Explain the difference between SQL and NoSQL databases.",
      output:
        "SQL databases use structured tables with predefined schemas and relationships. NoSQL databases are more flexible and can store unstructured data in various formats like documents or key-value pairs.",
      score: 72,
      reasoning:
        "The response provides a basic distinction between SQL and NoSQL databases but lacks depth. While it correctly identifies structured vs. unstructured nature, it misses important aspects like ACID properties, scalability differences, use cases, and specific examples. The explanation is accurate but superficial and would benefit from more comprehensive coverage of transaction handling, consistency models, and when to use each type.",
      metadata: { evaluationTime: 1156, modelVersion: "gpt-4" },
      createdAt: new Date("2024-01-16T14:20:00"),
    },
    {
      configId: 2,
      input: "How does machine learning differ from traditional programming?",
      output:
        "In traditional programming, developers write explicit rules and logic to solve problems. The program follows predefined instructions. In machine learning, instead of writing explicit rules, we feed data to algorithms that learn patterns and make predictions. The system improves its performance through experience without being explicitly programmed for every scenario. Traditional programming is deterministic, while ML is probabilistic and adapts based on training data.",
      score: 88,
      reasoning:
        "Excellent explanation that captures the fundamental distinction between traditional programming and machine learning. The response clearly articulates the rule-based nature of traditional programming versus the pattern-learning approach of ML. It effectively highlights the deterministic vs. probabilistic nature and mentions adaptability. The answer could be strengthened by including specific examples or discussing limitations of each approach.",
      metadata: { evaluationTime: 1389, modelVersion: "gpt-4-turbo" },
      createdAt: new Date("2024-01-18T09:15:00"),
    },
    {
      configId: 2,
      input: "What is the purpose of containerization in software development?",
      output:
        "Containerization packages software and its dependencies together so it runs consistently across different environments.",
      score: 65,
      reasoning:
        "The response provides a correct but very basic explanation of containerization. While it captures the core concept of packaging and consistency, it lacks important details about isolation, resource efficiency, portability benefits, and comparison with virtual machines. The answer would significantly benefit from discussing specific advantages like faster deployment, microservices architecture support, and DevOps workflow improvements. It is technically accurate but insufficiently comprehensive for a thorough understanding.",
      metadata: { evaluationTime: 982, modelVersion: "gpt-4-turbo" },
      createdAt: new Date("2024-01-20T16:45:00"),
    },
    {
      configId: 1,
      input: "Describe the concept of API rate limiting and why it is important.",
      output:
        "API rate limiting is a technique used to control the number of requests a client can make to an API within a specific time period. It is important for several reasons: 1) Prevents abuse and DDoS attacks by limiting excessive requests, 2) Ensures fair resource allocation among users, 3) Protects backend infrastructure from being overwhelmed, 4) Helps maintain quality of service for all users, and 5) Can be used as part of a monetization strategy with different tiers. Common implementations include token bucket, leaky bucket, and fixed/sliding window algorithms.",
      score: 92,
      reasoning:
        "Outstanding comprehensive answer that thoroughly explains API rate limiting. The response covers both the concept and importance with well-structured points. It successfully addresses security, fairness, infrastructure protection, and business aspects. The inclusion of specific implementation algorithms demonstrates deep understanding. Minor point deduction for not mentioning HTTP headers like X-RateLimit-Remaining or discussing client-side handling strategies, but overall this is an excellent, well-rounded explanation.",
      metadata: { evaluationTime: 1523, modelVersion: "gpt-4" },
      createdAt: new Date("2024-01-22T11:30:00"),
    },
  ];

  await db.insert(llmJudgeResults).values(sampleLlmJudgeResults);

  console.log("✅ LLM Judge Results seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
