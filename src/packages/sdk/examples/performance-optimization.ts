/**
 * Performance Optimization Examples
 * Demonstrates caching, batching, and pagination features
 */

import { AIEvalClient, RequestCache, CacheTTL, createPaginatedIterator, autoPaginate } from '../src';

/**
 * Example 1: Automatic Request Caching
 * GET requests are automatically cached with smart TTL
 */
async function exampleCaching() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
    debug: true,
  });

  console.log('=== Example 1: Automatic Caching ===');

  // First request - hits the API
  console.log('First request (cache miss)...');
  const traces1 = await client.traces.list({ limit: 10 });
  console.log(`Retrieved ${traces1.length} traces`);

  // Second request - served from cache
  console.log('Second request (cache hit)...');
  const traces2 = await client.traces.list({ limit: 10 });
  console.log(`Retrieved ${traces2.length} traces (from cache)`);

  // Mutation invalidates cache
  console.log('Creating new trace (invalidates cache)...');
  await client.traces.create({
    name: 'Performance Test',
    traceId: `perf-${Date.now()}`,
    status: 'success'
  });

  // Next request will hit API again
  console.log('Next request (cache miss after mutation)...');
  const traces3 = await client.traces.list({ limit: 10 });
  console.log(`Retrieved ${traces3.length} traces`);
}

/**
 * Example 2: Cache Configuration
 * Configure caching behavior for your needs
 */
async function exampleCacheConfiguration() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    debug: true,
    // Configure caching
    enableCaching: true,
    cacheSize: 500, // Limit cache to 500 entries
  });

  console.log('\n=== Example 2: Cache Configuration ===');

  // Caching is automatic - just configure and use
  const traces1 = await client.traces.list({ limit: 10 });
  console.log(`Retrieved ${traces1.length} traces`);

  // Subsequent identical requests are served from cache
  const traces2 = await client.traces.list({ limit: 10 });
  console.log(`Retrieved ${traces2.length} traces (cached)`);

  // Note: Cache is automatically invalidated when you create/update/delete
  console.log('Caching works transparently - no manual management needed!');
}

/**
 * Example 3: Pagination with Iterators
 * Efficiently iterate through all pages
 */
async function examplePagination() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
  });

  console.log('\n=== Example 3: Pagination ===');

  // Method 1: Manual pagination
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  console.log('Method 1: Manual pagination');
  while (hasMore) {
    const traces = await client.traces.list({ limit, offset });
    console.log(`Page ${offset / limit + 1}: ${traces.length} items`);
    
    hasMore = traces.length === limit;
    offset += limit;

    if (offset >= 200) break; // Limit for demo
  }

  // Method 2: Paginated iterator
  console.log('\nMethod 2: Using iterator');
  const iterator = createPaginatedIterator(
    async (offset, limit) => {
      const traces = await client.traces.list({ limit, offset });
      return { data: traces, hasMore: traces.length === limit };
    },
    50 // page size
  );

  let pageNum = 0;
  for await (const page of iterator) {
    pageNum++;
    console.log(`Page ${pageNum}: ${page.length} items`);
    if (pageNum >= 3) break; // Limit for demo
  }

  // Method 3: Auto-paginate (yields individual items)
  console.log('\nMethod 3: Auto-paginate');
  let count = 0;
  for await (const trace of autoPaginate(
    async (offset, limit) => {
      return await client.traces.list({ limit, offset });
    },
    50
  )) {
    count++;
    console.log(`Trace ${count}: ${trace.name}`);
    if (count >= 10) break; // Limit for demo
  }
}

/**
 * Example 4: Request Batching
 * Multiple requests combined for better performance
 */
async function exampleBatching() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
    enableBatching: true,
    batchSize: 10,
    batchDelay: 50, // Wait 50ms to collect more requests
  });

  console.log('\n=== Example 4: Request Batching ===');

  // These requests will be automatically batched
  const promises = [
    client.traces.list({ limit: 5 }),
    client.evaluations.list({ limit: 5 }),
    client.llmJudge.listConfigs({ limit: 5 }),
  ];

  console.log('Making 3 requests (will be batched)...');
  const results = await Promise.all(promises);
  
  console.log('Results:');
  console.log(`- Traces: ${results[0].length}`);
  console.log(`- Evaluations: ${results[1].length}`);
  console.log(`- Configs: ${results[2].length}`);
}

/**
 * Example 5: Connection Keep-Alive
 * Reuses connections for better performance
 */
async function exampleKeepAlive() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
    keepAlive: true, // Enable connection pooling
    timeout: 10000,
  });

  console.log('\n=== Example 5: Connection Keep-Alive ===');

  // Multiple sequential requests will reuse the connection
  const start = Date.now();
  
  for (let i = 0; i < 5; i++) {
    await client.traces.list({ limit: 10 });
    console.log(`Request ${i + 1} completed`);
  }

  const duration = Date.now() - start;
  console.log(`All 5 requests completed in ${duration}ms`);
  console.log('Connection pooling reduced overhead!');
}

/**
 * Example 6: Combined Optimizations
 * Use all performance features together
 */
async function exampleCombined() {
  const client = new AIEvalClient({
    apiKey: process.env.EVALAI_API_KEY!,
    organizationId: parseInt(process.env.EVALAI_ORGANIZATION_ID!),
    // Performance settings
    enableCaching: true,
    cacheSize: 1000,
    enableBatching: true,
    batchSize: 10,
    batchDelay: 50,
    keepAlive: true,
    // Reliability settings
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
    },
    timeout: 30000,
    debug: true,
  });

  console.log('\n=== Example 6: Combined Optimizations ===');

  // Efficient pagination with caching
  let total = 0;
  for await (const trace of autoPaginate(
    async (offset, limit) => {
      return await client.traces.list({ limit, offset });
    },
    100 // Large page size for efficiency
  )) {
    total++;
    if (total >= 50) break;
  }

  console.log(`Processed ${total} traces with optimal performance`);
}

// Run all examples
async function main() {
  try {
    await exampleCaching();
    await exampleCacheConfiguration();
    await examplePagination();
    await exampleBatching();
    await exampleKeepAlive();
    await exampleCombined();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run
// main();

export {
  exampleCaching,
  exampleCacheConfiguration,
  examplePagination,
  exampleBatching,
  exampleKeepAlive,
  exampleCombined,
};

