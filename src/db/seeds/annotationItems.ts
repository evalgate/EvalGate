import { db } from "@/db";
import { annotationItems, user } from "@/db/schema";

async function main() {
  const users = await db.select().from(user);

  if (users.length === 0) {
    console.error("❌ No users found. Please seed users table first.");
    return;
  }

  const userId = users[0].id;

  const sampleAnnotationItems = [
    {
      taskId: 1,
      content: "The new AI assistant helps automate customer support responses effectively.",
      annotation: JSON.stringify({ rating: 5, feedback: "Excellent response quality" }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-15T10:30:00").toISOString(),
      createdAt: new Date("2024-01-15T09:00:00").toISOString(),
    },
    {
      taskId: 1,
      content: "Product delivery was delayed by three days without proper notification.",
      annotation: JSON.stringify({ rating: 2, feedback: "Poor communication" }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-16T11:15:00").toISOString(),
      createdAt: new Date("2024-01-16T09:30:00").toISOString(),
    },
    {
      taskId: 1,
      content: "The documentation is comprehensive and easy to follow for beginners.",
      annotation: JSON.stringify({ rating: 4, feedback: "Very helpful content" }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-17T14:20:00").toISOString(),
      createdAt: new Date("2024-01-17T10:00:00").toISOString(),
    },
    {
      taskId: 1,
      content: "Website interface is confusing and lacks intuitive navigation.",
      annotation: JSON.stringify({ rating: 3, feedback: "Needs improvement" }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-18T09:45:00").toISOString(),
      createdAt: new Date("2024-01-18T08:15:00").toISOString(),
    },
    {
      taskId: 1,
      content: "Customer service team resolved my issue within 24 hours professionally.",
      annotation: null,
      annotatedBy: null,
      annotatedAt: null,
      createdAt: new Date("2024-01-19T11:00:00").toISOString(),
    },
    {
      taskId: 1,
      content: "The mobile app crashes frequently when uploading large files.",
      annotation: null,
      annotatedBy: null,
      annotatedAt: null,
      createdAt: new Date("2024-01-20T13:30:00").toISOString(),
    },
    {
      taskId: 2,
      content:
        "This email appears to be a phishing attempt requesting sensitive banking information.",
      annotation: JSON.stringify({
        classification: "spam",
        confidence: 0.95,
        tags: ["phishing", "financial"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-21T10:00:00").toISOString(),
      createdAt: new Date("2024-01-21T09:00:00").toISOString(),
    },
    {
      taskId: 2,
      content: "Monthly newsletter with product updates and company news for subscribers.",
      annotation: JSON.stringify({
        classification: "legitimate",
        confidence: 0.98,
        tags: ["newsletter", "marketing"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-22T11:30:00").toISOString(),
      createdAt: new Date("2024-01-22T09:15:00").toISOString(),
    },
    {
      taskId: 2,
      content:
        "Urgent account verification required - click here to confirm your identity immediately.",
      annotation: JSON.stringify({
        classification: "spam",
        confidence: 0.89,
        tags: ["phishing", "urgent"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-23T14:15:00").toISOString(),
      createdAt: new Date("2024-01-23T10:30:00").toISOString(),
    },
    {
      taskId: 2,
      content: "Invoice for your recent purchase of office supplies with payment details attached.",
      annotation: JSON.stringify({
        classification: "legitimate",
        confidence: 0.92,
        tags: ["invoice", "business"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-24T09:30:00").toISOString(),
      createdAt: new Date("2024-01-24T08:00:00").toISOString(),
    },
    {
      taskId: 2,
      content: "Congratulations! You have won $1 million in our international lottery draw.",
      annotation: null,
      annotatedBy: null,
      annotatedAt: null,
      createdAt: new Date("2024-01-25T12:00:00").toISOString(),
    },
    {
      taskId: 2,
      content: "Password reset confirmation for your online banking account as requested.",
      annotation: null,
      annotatedBy: null,
      annotatedAt: null,
      createdAt: new Date("2024-01-26T15:45:00").toISOString(),
    },
    {
      taskId: 3,
      content: "Compare responses from GPT-4 and Claude for summarizing technical documentation.",
      annotation: JSON.stringify({
        modelA: "gpt-4",
        modelB: "claude-3",
        winner: "modelA",
        reasoning: "More concise and technically accurate summary",
        criteria: ["accuracy", "clarity", "conciseness"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-27T10:30:00").toISOString(),
      createdAt: new Date("2024-01-27T09:00:00").toISOString(),
    },
    {
      taskId: 3,
      content: "Evaluate different AI models for generating creative marketing copy.",
      annotation: JSON.stringify({
        modelA: "gpt-4",
        modelB: "claude-3",
        winner: "modelB",
        reasoning: "More engaging tone and better call-to-action",
        criteria: ["creativity", "engagement", "persuasiveness"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-28T13:15:00").toISOString(),
      createdAt: new Date("2024-01-28T11:00:00").toISOString(),
    },
    {
      taskId: 3,
      content: "Compare code generation capabilities for building REST API endpoints.",
      annotation: JSON.stringify({
        modelA: "gpt-4",
        modelB: "claude-3",
        winner: "tie",
        reasoning: "Both models provided equally valid and functional implementations",
        criteria: ["correctness", "efficiency", "best practices"],
      }),
      annotatedBy: userId,
      annotatedAt: new Date("2024-01-29T16:00:00").toISOString(),
      createdAt: new Date("2024-01-29T14:30:00").toISOString(),
    },
  ];

  await db.insert(annotationItems).values(sampleAnnotationItems);

  console.log("✅ Annotation items seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
