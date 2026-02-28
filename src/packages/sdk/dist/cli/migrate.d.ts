/**
 * COMPAT-203: Config → DSL migration generator (file-based)
 *
 * CLI command: evalai migrate config --in evalai.config.json --out eval/legacy.spec.ts
 * Generates defineEval() calls with comments and TODOs for manual completion
 */
import { Command } from "commander";
/**
 * Migration options
 */
interface MigrateOptions {
    /** Input config file path */
    input: string;
    /** Output DSL file path */
    output: string;
    /** Include detailed comments */
    verbose?: boolean;
    /** Generate helper functions */
    helpers?: boolean;
    /** Preserve original test IDs */
    preserveIds?: boolean;
    /** Include provenance metadata */
    provenance?: boolean;
}
/**
 * Main migration function
 */
export declare function migrateConfig(options: MigrateOptions): Promise<void>;
/**
 * CLI command definition
 */
export declare function createMigrateCommand(): Command;
/**
 * Validate config file structure
 */
export declare function validateConfigFile(filePath: string): Promise<boolean>;
/**
 * Show migration preview without writing files
 */
export declare function previewMigration(filePath: string): Promise<void>;
export {};
