/**
 * Data Export/Import System
 * Tier 4.18: Platform migration and backup utilities
 *
 * @example
 * ```typescript
 * import { exportData, importData } from '@ai-eval-platform/sdk';
 *
 * // Export all data
 * const data = await exportData(client, {
 *   format: 'json',
 *   includeTraces: true,
 *   includeEvaluations: true
 * });
 *
 * // Save to file
 * fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));
 *
 * // Import from another platform
 * await importFromLangSmith(client, langsmithData);
 * ```
 */
import type { AIEvalClient } from './client';
import type { Trace, Evaluation, TestCase, EvaluationRun } from './types';
export type ExportFormat = 'json' | 'csv' | 'jsonl';
export type { ExportFormat as ExportType };
export interface ExportOptions {
    /** Export format */
    format: 'json' | 'csv' | 'jsonl';
    /** Include traces */
    includeTraces?: boolean;
    /** Include evaluations */
    includeEvaluations?: boolean;
    /** Include test cases */
    includeTestCases?: boolean;
    /** Include evaluation runs */
    includeRuns?: boolean;
    /** Date range filter */
    dateRange?: {
        from: string;
        to: string;
    };
    /** Organization ID filter */
    organizationId?: number;
    /** Maximum items to export (default: no limit) */
    limit?: number;
}
export interface ExportData {
    /** Export metadata */
    metadata: {
        exportedAt: string;
        version: string;
        format: string;
        organizationId?: number;
    };
    /** Exported traces */
    traces?: Trace[];
    /** Exported evaluations */
    evaluations?: Evaluation[];
    /** Exported test cases */
    testCases?: TestCase[];
    /** Exported runs */
    runs?: EvaluationRun[];
}
export interface ImportOptions {
    /** Organization ID to import into */
    organizationId?: number;
    /** User ID for created resources */
    createdBy?: number;
    /** Skip duplicates (based on name) */
    skipDuplicates?: boolean;
    /** Dry run (don't actually import) */
    dryRun?: boolean;
}
export interface ImportResult {
    /** Import summary */
    summary: {
        total: number;
        imported: number;
        skipped: number;
        failed: number;
    };
    /** Detailed results */
    details: {
        traces?: {
            imported: number;
            skipped: number;
            failed: number;
        };
        evaluations?: {
            imported: number;
            skipped: number;
            failed: number;
        };
        testCases?: {
            imported: number;
            skipped: number;
            failed: number;
        };
        runs?: {
            imported: number;
            skipped: number;
            failed: number;
        };
    };
    /** Errors encountered */
    errors?: Array<{
        item: string;
        error: string;
    }>;
}
/**
 * Export data from the platform
 *
 * @example
 * ```typescript
 * const data = await exportData(client, {
 *   format: 'json',
 *   includeTraces: true,
 *   includeEvaluations: true,
 *   dateRange: { from: '2024-01-01', to: '2024-12-31' }
 * });
 *
 * // Save to file
 * fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));
 * ```
 */
export declare function exportData(client: AIEvalClient, options: ExportOptions): Promise<ExportData>;
/**
 * Import data into the platform
 *
 * @example
 * ```typescript
 * const data = JSON.parse(fs.readFileSync('backup.json', 'utf-8'));
 * const result = await importData(client, data, {
 *   organizationId: 123,
 *   skipDuplicates: true
 * });
 *
 * console.log(`Imported ${result.summary.imported} items`);
 * ```
 */
export declare function importData(client: AIEvalClient, data: ExportData, options: ImportOptions): Promise<ImportResult>;
/**
 * Export data to JSON file
 *
 * @example
 * ```typescript
 * await exportToFile(client, './backup.json', {
 *   includeTraces: true,
 *   includeEvaluations: true
 * });
 * ```
 */
export declare function exportToFile(client: AIEvalClient, filePath: string, options: Omit<ExportOptions, 'format'>): Promise<void>;
/**
 * Import data from JSON file
 *
 * @example
 * ```typescript
 * const result = await importFromFile(client, './backup.json', {
 *   organizationId: 123,
 *   createdBy: 1
 * });
 * ```
 */
export declare function importFromFile(client: AIEvalClient, filePath: string, options: ImportOptions): Promise<ImportResult>;
/**
 * Import from LangSmith format
 *
 * @example
 * ```typescript
 * const langsmithData = {
 *   runs: [
 *     { name: 'test-1', inputs: { ... }, outputs: { ... } }
 *   ]
 * };
 *
 * await importFromLangSmith(client, langsmithData, {
 *   organizationId: 123
 * });
 * ```
 */
export declare function importFromLangSmith(client: AIEvalClient, langsmithData: any, options: ImportOptions): Promise<ImportResult>;
/**
 * Convert export data to CSV format
 *
 * @example
 * ```typescript
 * const data = await exportData(client, { format: 'json', includeTraces: true });
 * const csv = convertToCSV(data, 'traces');
 * fs.writeFileSync('traces.csv', csv);
 * ```
 */
export declare function convertToCSV(data: ExportData, type: 'traces' | 'evaluations'): string;
