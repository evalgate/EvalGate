/**
 * EvalGate config loader
 * Discovery: evalgate.config.json → evalgate.config.js → evalgate.config.cjs → package.json evalgate
 */
import { type ProfileName } from "./profiles";
export interface EvalAIConfig {
    evaluationId?: string;
    baseUrl?: string;
    minScore?: number;
    minN?: number;
    maxDrop?: number;
    warnDrop?: number;
    allowWeakEvidence?: boolean;
    baseline?: "published" | "previous" | "production" | "auto";
    profile?: ProfileName;
    /** Monorepo: package path → config. Key = path relative to config dir (e.g. "apps/web", "packages/api"). */
    packages?: Record<string, Partial<EvalAIConfig>>;
}
/**
 * Find config file path in directory, walking up to root
 */
export declare function findConfigPath(cwd?: string): string | null;
/**
 * Load config from file system
 */
export declare function loadConfig(cwd?: string): EvalAIConfig | null;
/**
 * Merge config with CLI args. Priority: args > profile > config > defaults.
 */
export declare function mergeConfigWithArgs(config: EvalAIConfig | null, args: Partial<Record<string, string | number | boolean>>): Partial<EvalAIConfig>;
