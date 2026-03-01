/**
 * TICKET 1 — evalgate discover
 *
 * Your first "holy shit" moment feature
 *
 * Goal:
 * npm install
 * evalgate discover
 *
 * Output:
 * Found 42 behavioral specifications
 * Safety: 12
 * Accuracy: 18
 * Agents: 7
 * Tools: 5
 *
 * Why this matters:
 * - makes EvalGate feel alive
 * - proves DSL works
 * - enables intelligence layer
 *
 * This becomes your entry point command.
 */
/**
 * Discovered specification statistics
 */
export interface DiscoveryStats {
    /** Total number of specifications found */
    totalSpecs: number;
    /** Specifications by category/tag */
    categories: Record<string, number>;
    /** Specifications by file */
    files: Record<string, number>;
    /** Execution mode information */
    executionMode: {
        mode: string;
        hasSpecRuntime: boolean;
        hasLegacyRuntime: boolean;
        specFiles: string[];
        legacyConfig?: string;
    };
    /** Project metadata */
    project: {
        root: string;
        name: string;
        hasPackageJson: boolean;
        hasGit: boolean;
    };
}
/**
 * Specification analysis result
 */
export interface SpecAnalysis {
    /** Specification ID */
    id: string;
    /** Specification name */
    name: string;
    /** File path */
    file: string;
    /** Tags/categories */
    tags: string[];
    /** Has assertions */
    hasAssertions: boolean;
    /** Uses external models */
    usesModels: boolean;
    /** Uses tools */
    usesTools: boolean;
    /** Estimated complexity */
    complexity: "simple" | "medium" | "complex";
}
/**
 * Discover and analyze behavioral specifications in the current project
 */
export declare function discoverSpecs(options?: {
    manifest?: boolean;
}): Promise<DiscoveryStats>;
/**
 * Print discovery results in a beautiful format
 */
export declare function printDiscoveryResults(stats: DiscoveryStats): void;
/**
 * Run discovery command
 */
export declare function runDiscover(): Promise<void>;
