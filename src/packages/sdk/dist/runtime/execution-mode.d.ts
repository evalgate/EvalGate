/**
 * COMPAT-204: Dual-path execution toggle
 *
 * Environment flag EVALAI_RUNTIME=legacy|spec|auto
 * Auto uses spec runtime if manifest/specs exist, else legacy
 * Existing projects continue unchanged; new projects can use DSL only
 */
/**
 * Execution mode types
 */
export type ExecutionMode = "legacy" | "spec" | "auto";
/**
 * Execution mode configuration
 */
export interface ExecutionModeConfig {
    /** Current execution mode */
    mode: ExecutionMode;
    /** Whether spec runtime is available */
    hasSpecRuntime: boolean;
    /** Whether legacy runtime is available */
    hasLegacyRuntime: boolean;
    /** Project root path */
    projectRoot: string;
    /** Detected spec files */
    specFiles: string[];
    /** Detected legacy config */
    legacyConfig?: string;
}
/**
 * Get execution mode from environment or auto-detection
 */
export declare function getExecutionMode(projectRoot?: string): Promise<ExecutionModeConfig>;
/**
 * Check if project can run in spec mode
 */
export declare function canRunSpecMode(config: ExecutionModeConfig): boolean;
/**
 * Check if project can run in legacy mode
 */
export declare function canRunLegacyMode(config: ExecutionModeConfig): boolean;
/**
 * Get recommended execution mode for project
 */
export declare function getRecommendedExecutionMode(config: ExecutionModeConfig): ExecutionMode;
/**
 * Validate execution mode compatibility
 */
export declare function validateExecutionMode(config: ExecutionModeConfig): {
    valid: boolean;
    warnings: string[];
    errors: string[];
};
/**
 * Print execution mode information
 */
export declare function printExecutionModeInfo(config: ExecutionModeConfig): void;
/**
 * Environment variable helpers
 */
export declare const ENV_VARS: {
    readonly EXECUTION_MODE: "EVALAI_RUNTIME";
    readonly POSSIBLE_VALUES: readonly ["legacy", "spec", "auto"];
    readonly DEFAULT: "auto";
};
/**
 * Check if environment variable is set
 */
export declare function hasExecutionModeEnv(): boolean;
/**
 * Get current environment variable value
 */
export declare function getExecutionModeEnv(): string | undefined;
/**
 * Set execution mode environment variable
 */
export declare function setExecutionModeEnv(mode: ExecutionMode): void;
/**
 * Clear execution mode environment variable
 */
export declare function clearExecutionModeEnv(): void;
