import { db } from "@/db";
import { organizations } from "@/db/schema";

async function main() {
  const sampleOrganizations = [
    {
      name: "TechCorp AI Labs",
      createdAt: new Date("2024-09-15T10:30:00Z").toISOString(),
      updatedAt: new Date("2024-09-15T10:30:00Z").toISOString(),
    },
    {
      name: "Research Institute",
      createdAt: new Date("2024-10-22T14:45:00Z").toISOString(),
      updatedAt: new Date("2024-10-22T14:45:00Z").toISOString(),
    },
  ];

  await db.insert(organizations).values(sampleOrganizations);

  console.log("✅ Organizations seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
