/**
 * Demo Evaluation Run
 *
 * This example demonstrates how to run an evaluation using the AI Evaluation Platform SDK.
 * It creates an evaluation against a demo dataset and saves the results to a JSON file.
 *
 * Usage:
 *   npm run demo
 */

import fs from "node:fs";
import { AIEvalClient } from "@pauly4010/evalai-sdk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function runDemo() {
	try {
		// Initialize the client
		const client = AIEvalClient.init({
			apiKey: process.env.EVALAI_API_KEY,
		});

		console.log("🚀 Starting evaluation...\n");

		// Create an evaluation
		const result = await client.evaluations.create({
			datasetId: "public-demo-chatbot",
			metrics: ["factuality", "toxicity"],
			name: "Demo Chatbot Evaluation",
			description: "Testing chatbot responses for accuracy and safety",
		});

		console.log("✅ Evaluation complete!\n");
		console.log(`📊 Overall Score: ${result.overall}`);
		console.log(`✓ Passed: ${result.passed}`);
		console.log(`✗ Failed: ${result.failed}`);
		console.log(`⏱️  Avg Latency: ${result.avgLatency}ms`);
		console.log(`💰 Total Cost: $${result.totalCost}\n`);

		// Save results to file
		fs.writeFileSync("./demo-run.json", JSON.stringify(result, null, 2));
		console.log("💾 Results saved to demo-run.json");

		return result;
	} catch (error) {
		console.error("❌ Error running evaluation:", error.message);
		process.exit(1);
	}
}

// Run the demo
runDemo();
