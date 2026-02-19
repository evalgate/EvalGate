/**
 * EvalAI config loader
 * Discovery: evalai.config.json → evalai.config.js → evalai.config.cjs → package.json evalai
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { PROFILES, type ProfileName } from "./profiles";

export interface EvalAIConfig {
  evaluationId?: string;
  baseUrl?: string;
  minScore?: number;
  minN?: number;
  maxDrop?: number;
  allowWeakEvidence?: boolean;
  baseline?: "published" | "previous" | "production" | "auto";
  profile?: ProfileName;
  /** Monorepo: package path → config. Key = path relative to config dir (e.g. "apps/web", "packages/api"). */
  packages?: Record<string, Partial<EvalAIConfig>>;
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
    let config: EvalAIConfig | null = null;

    if (configPath.endsWith("package.json")) {
      const pkg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      config = (pkg.evalai as EvalAIConfig) ?? null;
    } else {
      const content = fs.readFileSync(configPath, "utf-8");
      if (configPath.endsWith(".json")) {
        config = JSON.parse(content) as EvalAIConfig;
      } else if (configPath.endsWith(".js") || configPath.endsWith(".cjs")) {
        try {
          config = JSON.parse(content) as EvalAIConfig;
        } catch {
          return null;
        }
      }
    }

    if (!config) return null;

    if (config.packages && Object.keys(config.packages).length > 0) {
      const configDir = path.dirname(configPath);
      const rel = path.relative(configDir, path.resolve(cwd));
      const relNorm = rel.split(path.sep).join("/");
      const pkgConfig = config.packages[relNorm];
      if (pkgConfig) {
        return { ...config, ...pkgConfig, packages: config.packages };
      }
      for (const key of Object.keys(config.packages)) {
        if (relNorm === key || relNorm.startsWith(`${key}/`)) {
          return { ...config, ...config.packages[key], packages: config.packages };
        }
      }
    }

    return config;
  } catch {
    return null;
  }
}

/**
 * Merge config with CLI args. Priority: args > profile > config > defaults.
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
    if (config.maxDrop != null) merged.maxDrop = config.maxDrop;
    if (config.allowWeakEvidence != null) merged.allowWeakEvidence = config.allowWeakEvidence;
    if (config.baseline) merged.baseline = config.baseline;
    if (config.profile) merged.profile = config.profile;
  }

  // Profile defaults (from --profile or config.profile). Apply before args override.
  const profileName = (args.profile ?? merged.profile) as ProfileName | undefined;
  if (profileName && profileName in PROFILES) {
    const profile = PROFILES[profileName as ProfileName];
    if (merged.minScore === undefined && args.minScore === undefined)
      merged.minScore = profile.minScore;
    if (merged.maxDrop === undefined && args.maxDrop === undefined)
      merged.maxDrop = profile.maxDrop;
    if (merged.minN === undefined && args.minN === undefined) merged.minN = profile.minN;
    if (merged.allowWeakEvidence === undefined && args.allowWeakEvidence === undefined)
      merged.allowWeakEvidence = profile.allowWeakEvidence;
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
  if (args.maxDrop !== undefined) {
    merged.maxDrop =
      typeof args.maxDrop === "number" ? args.maxDrop : parseInt(String(args.maxDrop), 10);
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
    if (b === "auto" || b === "previous" || b === "production") {
      merged.baseline = b;
    } else {
      merged.baseline = "published";
    }
  }
  if (args.profile !== undefined && args.profile !== "") {
    merged.profile = String(args.profile) as ProfileName;
  }

  return merged;
}
