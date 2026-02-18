import { db } from "@/db";
import { evaluationRuns } from "@/db/schema";

async function main() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sampleEvaluationRuns = [
    {
      evaluationId: 1,
      organizationId: 1,
      status: "completed",
      totalCases: 10,
      passedCases: 8,
      failedCases: 2,
      startedAt: new Date(yesterday.getTime() - 15 * 60 * 1000).toISOString(),
      completedAt: yesterday.toISOString(),
      createdAt: new Date(yesterday.getTime() - 20 * 60 * 1000).toISOString(),
    },
    {
      evaluationId: 2,
      organizationId: 1,
      status: "running",
      totalCases: 5,
      passedCases: 3,
      failedCases: 0,
      startedAt: twoHoursAgo.toISOString(),
      completedAt: null,
      createdAt: new Date(twoHoursAgo.getTime() - 5 * 60 * 1000).toISOString(),
    },
    {
      evaluationId: 3,
      organizationId: 1,
      status: "completed",
      totalCases: 8,
      passedCases: 8,
      failedCases: 0,
      startedAt: new Date(lastWeek.getTime() - 10 * 60 * 1000).toISOString(),
      completedAt: lastWeek.toISOString(),
      createdAt: new Date(lastWeek.getTime() - 15 * 60 * 1000).toISOString(),
    },
  ];

  await db.insert(evaluationRuns).values(sampleEvaluationRuns);

  console.log("✅ Evaluation runs seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
