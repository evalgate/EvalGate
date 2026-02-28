/**
 * Config → DSL Adapter - LAYER 2 Compatibility Bridge
 *
 * Migrates existing evalai.config.json and TestSuite configurations
 * to the new defineEval() DSL without breaking user workflows.
 */
import type { TestSuite } from "../../testing";
/**
 * Migration result information
 */
interface MigrationResult {
    success: boolean;
    specsGenerated: number;
    errors: string[];
    warnings: string[];
    outputPath: string;
}
/**
 * Convert TestSuite to defineEval() specifications
 */
export declare function migrateTestSuiteToDSL(testSuite: TestSuite, outputPath: string): MigrationResult;
/**
 * Convert evalai.config.json to DSL specifications
 */
export declare function migrateConfigToDSL(configPath: string, outputPath: string): MigrationResult;
/**
 * Discover and migrate all TestSuite configurations in a project
 */
export declare function migrateProjectToDSL(projectRoot: string, options?: {
    outputDir?: string;
    dryRun?: boolean;
}): MigrationResult;
export {};
