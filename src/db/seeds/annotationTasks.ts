import { db } from "@/db";
import { annotationTasks, user } from "@/db/schema";

async function main() {
  // Query user table to get a user ID for createdBy
  const users = await db.select().from(user).limit(1);

  if (users.length === 0) {
    console.error("❌ No users found in database. Please seed users first.");
    return;
  }

  const userId = users[0].id;

  const sampleAnnotationTasks = [
    {
      name: "Chatbot Response Quality",
      description:
        "Evaluate the quality and helpfulness of chatbot responses across various customer inquiries",
      type: "rating",
      status: "active",
      organizationId: 1,
      totalItems: 20,
      completedItems: 12,
      createdBy: userId,
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-15"),
    },
    {
      name: "Toxicity Classification",
      description: "Classify user-generated content for toxic, offensive, or harmful language",
      type: "classification",
      status: "active",
      organizationId: 1,
      totalItems: 50,
      completedItems: 35,
      createdBy: userId,
      createdAt: new Date("2024-01-12"),
      updatedAt: new Date("2024-01-18"),
    },
    {
      name: "Model Output Comparison",
      description: "Compare and select the better output between two AI model responses",
      type: "comparison",
      status: "completed",
      organizationId: 2,
      totalItems: 15,
      completedItems: 15,
      createdBy: userId,
      createdAt: new Date("2024-01-05"),
      updatedAt: new Date("2024-01-20"),
    },
  ];

  await db.insert(annotationTasks).values(sampleAnnotationTasks);

  console.log("✅ Annotation tasks seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
