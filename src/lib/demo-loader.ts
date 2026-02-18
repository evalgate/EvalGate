/**
 * Demo Loader - Fetch and manage demo evaluation data
 * Used for unauthenticated users and public sharing
 */

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
  qualityScore: any;
  timestamp: string;
  [key: string]: any;
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
    console.error("Error loading default demo:", error);
    return null;
  }
}

/**
 * Get a specific public demo by ID
 */
export async function getPublicDemo(id: string): Promise<DemoEvaluation | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${baseUrl}/exports/public/${id}.json`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Failed to load demo ${id}:`, res.status);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`Error loading demo ${id}:`, error);
    return null;
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
    console.error("Error loading public demos:", error);
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
  return getPublicDemo(demoId);
}

/**
 * Check if a demo is publicly available
 */
export async function isDemoPublic(id: string): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${baseUrl}/exports/public/${id}.json`, {
      method: "HEAD",
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
export function validateDemoData(data: any): data is DemoEvaluation {
  return (
    data &&
    typeof data === "object" &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    typeof data.type === "string" &&
    data.summary &&
    typeof data.summary.totalTests === "number" &&
    data.qualityScore
  );
}
