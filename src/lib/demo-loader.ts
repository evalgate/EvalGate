/**
 * Demo Loader - Fetch and manage demo evaluation data
 * Used for unauthenticated users and public sharing
 */

import type { QualityScore } from "@/lib/ai-quality-score";
import { logger } from "@/lib/logger";

interface TestResult {
	id?: number | string;
	name?: string;
	passed?: boolean;
	input?: string | unknown;
	expectedOutput?: string;
	actualOutput?: string;
	score?: number;
}

export type { TestResult };

export interface DemoEvaluation {
	id: string;
	name: string;
	description: string;
	type: "unit_test" | "human_eval" | "model_eval" | "ab_test";
	category?: string;
	summary: {
		totalTests: number;
		passed: number;
		failed: number;
		passRate: string;
	};
	qualityScore?: QualityScore;
	timestamp: string;
	testResults?: TestResult[];
	[key: string]: unknown;
}

const DEFAULT_DEMO_URL = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/exports/demo-eval.json`;

/**
 * Get the default demo evaluation for unauthenticated users
 */
export async function getDefaultDemo(): Promise<DemoEvaluation | null> {
	try {
		const res = await fetch(DEFAULT_DEMO_URL, {
			cache: "no-store", // Always fetch fresh data
		});

		if (!res.ok) {
			console.warn("Failed to load default demo:", res.status);
			return null;
		}

		return await res.json();
	} catch (error) {
		logger.error("Error loading default demo", error);
		return null;
	}
}

export type GetPublicDemoResult =
	| { data: DemoEvaluation; error?: never }
	| { data: null; error: "expired" | "revoked" | "not_found" };

/**
 * Get a specific public demo by ID from the exports API.
 * Propagates 410 (expired/revoked) vs 404 (not found) so the share page can show the right message.
 */
export async function getPublicDemo(id: string): Promise<GetPublicDemoResult> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
		const res = await fetch(`${baseUrl}/api/exports/${id}`, {
			cache: "no-store",
		});

		if (res.status === 410) {
			const body = await res.json().catch(() => ({}));
			const code = (body as { error?: { code?: string } })?.error?.code;
			return {
				data: null,
				error: code === "SHARE_REVOKED" ? "revoked" : "expired",
			};
		}
		if (res.status === 404) {
			return { data: null, error: "not_found" };
		}
		if (!res.ok) {
			console.warn(`Failed to load demo ${id}:`, res.status);
			return { data: null, error: "not_found" };
		}

		const data = await res.json();
		return { data };
	} catch (error) {
		logger.error("Error loading demo", { error, demoId: id });
		return { data: null, error: "not_found" };
	}
}

/**
 * Get all available public demos
 */
export async function getPublicDemos(): Promise<DemoEvaluation[]> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
		const res = await fetch(`${baseUrl}/exports/public/index.json`, {
			cache: "no-store",
		});

		if (!res.ok) {
			console.warn("Failed to load public demos index:", res.status);
			return [];
		}

		const index = await res.json();
		return index.demos || [];
	} catch (error) {
		logger.error("Error loading public demos", error);
		return [];
	}
}

/**
 * Predefined demo IDs for homepage tiles
 */
export const DEMO_IDS = {
	CHATBOT: "chatbot-demo",
	RAG: "rag-demo",
	CODEGEN: "codegen-demo",
	SAFETY: "safety-demo",
	MULTIMODAL: "multimodal-demo",
} as const;

/**
 * Get a predefined demo by type
 */
export async function getPredefinedDemo(
	type: keyof typeof DEMO_IDS,
): Promise<DemoEvaluation | null> {
	const demoId = DEMO_IDS[type];
	const result = await getPublicDemo(demoId);
	return result.data;
}

/**
 * Check if a demo is publicly available
 */
export async function isDemoPublic(id: string): Promise<boolean> {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
		const res = await fetch(`${baseUrl}/api/exports/${id}`, {
			cache: "no-store",
		});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Generate a shareable URL for a demo
 */
export function getShareUrl(id: string): string {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
	return `${baseUrl}/share/${id}`;
}

/**
 * Validate demo data structure
 */
export function validateDemoData(data: unknown): data is DemoEvaluation {
	if (!data || typeof data !== "object") return false;
	const d = data as Record<string, unknown>;
	return !!(
		typeof d.id === "string" &&
		typeof d.name === "string" &&
		typeof d.type === "string" &&
		d.summary &&
		typeof d.summary === "object" &&
		typeof (d.summary as Record<string, unknown>).totalTests === "number" &&
		d.qualityScore
	);
}
