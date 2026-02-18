import { db } from "@/db";
import { evaluations, user } from "@/db/schema";

async function main() {
  // Query user table to get an existing user ID
  const existingUsers = await db.select({ id: user.id }).from(user).limit(1);

  if (existingUsers.length === 0) {
    throw new Error("No users found in database. Please seed users first.");
  }

  const userId = existingUsers[0].id;

  const sampleEvaluations = [
    {
      name: "GPT-4 Response Quality",
      type: "unit_test",
      status: "completed",
      organizationId: 1,
      description: "Automated testing of GPT-4 responses for accuracy and coherence",
      createdBy: userId,
      createdAt: new Date("2024-01-10").toISOString(),
      updatedAt: new Date("2024-01-15").toISOString(),
    },
    {
      name: "Customer Support Chatbot",
      type: "human_eval",
      status: "running",
      organizationId: 1,
      description: "Human evaluation of chatbot responses in customer support scenarios",
      createdBy: userId,
      createdAt: new Date("2024-01-12").toISOString(),
      updatedAt: new Date("2024-01-20").toISOString(),
    },
    {
      name: "Model A vs Model B Comparison",
      type: "ab_test",
      status: "completed",
      organizationId: 1,
      description: "A/B testing comparing two language models",
      createdBy: userId,
      createdAt: new Date("2024-01-08").toISOString(),
      updatedAt: new Date("2024-01-18").toISOString(),
    },
    {
      name: "Sentiment Analysis Accuracy",
      type: "unit_test",
      status: "draft",
      organizationId: 2,
      description: "Testing sentiment analysis model accuracy",
      createdBy: userId,
      createdAt: new Date("2024-01-22").toISOString(),
      updatedAt: new Date("2024-01-22").toISOString(),
    },
    {
      name: "Translation Quality Assessment",
      type: "human_eval",
      status: "completed",
      organizationId: 2,
      description: "Human evaluation of machine translation quality",
      createdBy: userId,
      createdAt: new Date("2024-01-05").toISOString(),
      updatedAt: new Date("2024-01-16").toISOString(),
    },
  ];

  await db.insert(evaluations).values(sampleEvaluations);

  console.log("✅ Evaluations seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
