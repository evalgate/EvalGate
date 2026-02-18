/**
 * EvalAI config loader
 * Discovery: evalai.config.json → evalai.config.js → evalai.config.cjs → package.json evalai
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface EvalAIConfig {
  evaluationId?: string;
  baseUrl?: string;
  minScore?: number;
  minN?: number;
  allowWeakEvidence?: boolean;
  baseline?: "published" | "previous" | "production";
}

const CONFIG_FILES = ["evalai.config.json", "evalai.config.js", "evalai.config.cjs"];

/**
 * Find config file path in directory, walking up to root
 */
export function findConfigPath(cwd: string = process.cwd()): string | null {
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const file of CONFIG_FILES) {
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    // Check package.json for evalai field
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.evalai != null) {
          return pkgPath;
        }
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Load config from file system
 */
export function loadConfig(cwd: string = process.cwd()): EvalAIConfig | null {
  const configPath = findConfigPath(cwd);
  if (!configPath) return null;

  try {
    if (configPath.endsWith("package.json")) {
      const pkg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return (pkg.evalai as EvalAIConfig) ?? null;
    }

    const content = fs.readFileSync(configPath, "utf-8");

    if (configPath.endsWith(".json")) {
      return JSON.parse(content) as EvalAIConfig;
    }

    // .js or .cjs - would need to require/import; for v1 we only support JSON
    if (configPath.endsWith(".js") || configPath.endsWith(".cjs")) {
      // Try to parse as JSON first (some projects use .js with JSON content)
      try {
        return JSON.parse(content) as EvalAIConfig;
      } catch {
        // Dynamic require of .js could have side effects; skip for v1
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Merge config with CLI args. Priority: args > config > defaults.
 */
export function mergeConfigWithArgs(
  config: EvalAIConfig | null,
  args: Partial<Record<string, string | number | boolean>>,
): Partial<EvalAIConfig> {
  const merged: Partial<EvalAIConfig> = {};

  if (config) {
    if (config.evaluationId) merged.evaluationId = config.evaluationId;
    if (config.baseUrl) merged.baseUrl = config.baseUrl;
    if (config.minScore != null) merged.minScore = config.minScore;
    if (config.minN != null) merged.minN = config.minN;
    if (config.allowWeakEvidence != null) merged.allowWeakEvidence = config.allowWeakEvidence;
    if (config.baseline) merged.baseline = config.baseline;
  }

  // Args override
  if (args.evaluationId !== undefined && args.evaluationId !== "") {
    merged.evaluationId = String(args.evaluationId);
  }
  if (args.baseUrl !== undefined && args.baseUrl !== "") {
    merged.baseUrl = String(args.baseUrl);
  }
  if (args.minScore !== undefined) {
    merged.minScore =
      typeof args.minScore === "number" ? args.minScore : parseInt(String(args.minScore), 10);
  }
  if (args.minN !== undefined) {
    merged.minN = typeof args.minN === "number" ? args.minN : parseInt(String(args.minN), 10);
  }
  if (args.allowWeakEvidence !== undefined) {
    merged.allowWeakEvidence =
      args.allowWeakEvidence === true ||
      args.allowWeakEvidence === "true" ||
      args.allowWeakEvidence === "1";
  }
  if (args.baseline !== undefined && args.baseline !== "") {
    const b = String(args.baseline);
    if (b === "previous" || b === "production") {
      merged.baseline = b;
    } else {
      merged.baseline = "published";
    }
  }

  return merged;
}
