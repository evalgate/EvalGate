import { db } from "@/db";
import { llmJudgeConfigs, user } from "@/db/schema";

async function main() {
  // First, query the user table to get a valid user ID
  const existingUsers = await db.select({ id: user.id }).from(user).limit(1);

  if (existingUsers.length === 0) {
    console.error("❌ No users found in database. Please seed users first.");
    return;
  }

  const userId = existingUsers[0].id;

  const sampleConfigs = [
    {
      name: "Helpfulness Evaluator",
      organizationId: 1,
      model: "gpt-4",
      promptTemplate:
        "Evaluate the following response for helpfulness on a scale of 1-10. Consider clarity, completeness, and actionability.\n\nUser Query: {{input}}\n\nAssistant Response: {{output}}\n\nProvide your evaluation with detailed reasoning.",
      criteria: {
        clarity: {
          weight: 0.3,
          description: "How clear and easy to understand is the response",
        },
        completeness: {
          weight: 0.4,
          description: "Does the response fully address the user query",
        },
        actionability: {
          weight: 0.3,
          description: "Can the user take concrete action based on this response",
        },
      },
      createdBy: userId,
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    },
    {
      name: "Accuracy Checker",
      organizationId: 2,
      model: "claude-3-opus",
      promptTemplate:
        "Assess the factual accuracy of the following response. Check for correctness, consistency, and reliability of information.\n\nQuestion: {{input}}\n\nResponse: {{output}}\n\nRate accuracy from 1-10 and explain unknown inaccuracies found.",
      criteria: {
        factualCorrectness: {
          weight: 0.5,
          description: "Are the facts and statements objectively correct",
        },
        consistency: {
          weight: 0.3,
          description: "Is the information internally consistent without contradictions",
        },
        sourceReliability: {
          weight: 0.2,
          description: "Are claims supported by reliable reasoning or known facts",
        },
      },
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
      updatedAt: new Date("2024-01-20"),
    },
  ];

  await db.insert(llmJudgeConfigs).values(sampleConfigs);

  console.log("✅ LLM Judge Configs seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
