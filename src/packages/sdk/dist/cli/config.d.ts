/**
 * EvalAI config loader
 * Discovery: evalai.config.json → evalai.config.js → evalai.config.cjs → package.json evalai
 */
export interface EvalAIConfig {
    evaluationId?: string;
    baseUrl?: string;
    minScore?: number;
    minN?: number;
    allowWeakEvidence?: boolean;
    baseline?: 'published' | 'previous' | 'production';
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
 * Merge config with CLI args. Priority: args > config > defaults.
 */
export declare function mergeConfigWithArgs(config: EvalAIConfig | null, args: Partial<Record<string, string | number | boolean>>): Partial<EvalAIConfig>;
