import { db } from "@/db";
import { apiKeys, apiUsageLogs, user } from "@/db/schema";

async function main() {
  // Query valid apiKeyId and userId values
  const validApiKeys = await db.select({ id: apiKeys.id }).from(apiKeys);
  const validUsers = await db.select({ id: user.id }).from(user);

  if (validApiKeys.length === 0 || validUsers.length === 0) {
    throw new Error("Please seed api_keys and user tables first before seeding api_usage_logs");
  }

  const apiKeyIds = validApiKeys.map((k) => k.id);
  const userIds = validUsers.map((u) => u.id);

  // Endpoint distribution
  const endpoints = [
    { path: "/api/traces", weight: 30 },
    { path: "/api/evaluations", weight: 25 },
    { path: "/api/traces/[id]", weight: 15 },
    { path: "/api/evaluations/[id]/runs", weight: 10 },
    { path: "/api/annotations/tasks", weight: 10 },
    { path: "/api/llm-judge/configs", weight: 10 },
  ];

  // Method distribution
  const methods = [
    { method: "POST", weight: 50 },
    { method: "GET", weight: 30 },
    { method: "PUT", weight: 15 },
    { method: "DELETE", weight: 5 },
  ];

  // Status code distribution
  const statusCodes = [
    { code: 200, weight: 70 },
    { code: 201, weight: 15 },
    { code: 400, weight: 8 },
    { code: 401, weight: 4 },
    { code: 404, weight: 2 },
    { code: 500, weight: 1 },
  ];

  // Response time ranges by method
  const responseTimeRanges = {
    GET: { min: 50, max: 300 },
    POST: { min: 100, max: 800 },
    PUT: { min: 150, max: 500 },
    DELETE: { min: 50, max: 200 },
  };

  // Helper to get weighted random item
  function getWeightedRandom<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }
    return items[items.length - 1];
  }

  // Helper to get random item from array
  function getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  // Helper to get random int in range
  function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Helper to generate timestamp in last 7 days with bias towards recent
  function getWeightedTimestamp(): string {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Use exponential distribution to bias towards recent dates
    const random = Math.random() ** 2; // Square for stronger bias
    const timeDiff = now.getTime() - sevenDaysAgo.getTime();
    const timestamp = new Date(now.getTime() - timeDiff * (1 - random));

    return timestamp.toISOString();
  }

  const sampleLogs = [];

  for (let i = 0; i < 100; i++) {
    const useApiKey = Math.random() < 0.6; // 60% with apiKeyId
    const selectedEndpoint = getWeightedRandom(endpoints);
    const selectedMethod = getWeightedRandom(methods);
    const selectedStatus = getWeightedRandom(statusCodes);
    const orgId = Math.random() < 0.6 ? 1 : 2; // 60% org 1, 40% org 2

    const responseTimeRange =
      responseTimeRanges[selectedMethod.method as keyof typeof responseTimeRanges];
    const responseTime = getRandomInt(responseTimeRange.min, responseTimeRange.max);

    const log = {
      apiKeyId: useApiKey ? getRandomItem(apiKeyIds) : null,
      userId: useApiKey ? null : getRandomItem(userIds),
      organizationId: orgId,
      endpoint: selectedEndpoint.path,
      method: selectedMethod.method,
      statusCode: selectedStatus.code,
      responseTimeMs: responseTime,
      createdAt: getWeightedTimestamp(),
    };

    sampleLogs.push(log);
  }

  // Sort by createdAt to maintain chronological order
  sampleLogs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  await db.insert(apiUsageLogs).values(sampleLogs);

  console.log("✅ API usage logs seeder completed successfully");
  console.log(`   - Generated 100 logs across last 7 days`);
  console.log(`   - ${sampleLogs.filter((l) => l.apiKeyId).length} with API key authentication`);
  console.log(`   - ${sampleLogs.filter((l) => l.userId).length} with user authentication`);
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
