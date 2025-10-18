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

// Re-export for backward compatibility
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
    traces?: { imported: number; skipped: number; failed: number };
    evaluations?: { imported: number; skipped: number; failed: number };
    testCases?: { imported: number; skipped: number; failed: number };
    runs?: { imported: number; skipped: number; failed: number };
  };
  /** Errors encountered */
  errors?: Array<{ item: string; error: string }>;
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
export async function exportData(
  client: AIEvalClient,
  options: ExportOptions
): Promise<ExportData> {
  const exportData: ExportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      format: options.format,
      organizationId: options.organizationId
    }
  };

  // Export traces
  if (options.includeTraces) {
    const traces = await client.traces.list({
      organizationId: options.organizationId,
      limit: options.limit
    });
    exportData.traces = traces;
  }

  // Export evaluations
  if (options.includeEvaluations) {
    const evaluations = await client.evaluations.list({
      organizationId: options.organizationId,
      limit: options.limit
    });
    exportData.evaluations = evaluations;

    // Export test cases for each evaluation
    if (options.includeTestCases) {
      const allTestCases: TestCase[] = [];
      for (const evaluation of evaluations) {
        const testCases = await client.evaluations.listTestCases(evaluation.id);
        allTestCases.push(...testCases);
      }
      exportData.testCases = allTestCases;
    }

    // Export runs for each evaluation
    if (options.includeRuns) {
      const allRuns: EvaluationRun[] = [];
      for (const evaluation of evaluations) {
        const runs = await client.evaluations.listRuns(evaluation.id);
        allRuns.push(...runs);
      }
      exportData.runs = allRuns;
    }
  }

  return exportData;
}

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
export async function importData(
  client: AIEvalClient,
  data: ExportData,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    summary: { total: 0, imported: 0, skipped: 0, failed: 0 },
    details: {},
    errors: []
  };

  if (options.dryRun) {
    // Count what would be imported
    if (data.traces) result.summary.total += data.traces.length;
    if (data.evaluations) result.summary.total += data.evaluations.length;
    if (data.testCases) result.summary.total += data.testCases.length;
    if (data.runs) result.summary.total += data.runs.length;
    return result;
  }

  // Import traces
  if (data.traces) {
    const traceResults = { imported: 0, skipped: 0, failed: 0 };
    for (const trace of data.traces) {
      try {
        await client.traces.create({
          name: trace.name,
          traceId: trace.traceId,
          organizationId: options.organizationId || trace.organizationId,
          status: trace.status,
          durationMs: trace.durationMs || undefined,
          metadata: trace.metadata || undefined
        });
        traceResults.imported++;
        result.summary.imported++;
      } catch (error) {
        if (options.skipDuplicates && error instanceof Error && error.message.includes('already exists')) {
          traceResults.skipped++;
          result.summary.skipped++;
        } else {
          traceResults.failed++;
          result.summary.failed++;
          result.errors?.push({
            item: `trace:${trace.traceId}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    result.details.traces = traceResults;
    result.summary.total += data.traces.length;
  }

  // Import evaluations
  if (data.evaluations) {
    const evalResults = { imported: 0, skipped: 0, failed: 0 };
    for (const evaluation of data.evaluations) {
      try {
        if (!options.createdBy) {
          throw new Error('createdBy is required for importing evaluations');
        }
        
        await client.evaluations.create({
          name: evaluation.name,
          description: evaluation.description || undefined,
          type: evaluation.type,
          organizationId: options.organizationId || evaluation.organizationId,
          createdBy: options.createdBy,
          status: evaluation.status
        });
        evalResults.imported++;
        result.summary.imported++;
      } catch (error) {
        if (options.skipDuplicates && error instanceof Error && error.message.includes('already exists')) {
          evalResults.skipped++;
          result.summary.skipped++;
        } else {
          evalResults.failed++;
          result.summary.failed++;
          result.errors?.push({
            item: `evaluation:${evaluation.name}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    result.details.evaluations = evalResults;
    result.summary.total += data.evaluations.length;
  }

  return result;
}

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
export async function exportToFile(
  client: AIEvalClient,
  filePath: string,
  options: Omit<ExportOptions, 'format'>
): Promise<void> {
  const data = await exportData(client, { ...options, format: 'json' });
  const fs = await import('fs');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

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
export async function importFromFile(
  client: AIEvalClient,
  filePath: string,
  options: ImportOptions
): Promise<ImportResult> {
  const fs = await import('fs');
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as ExportData;
  return importData(client, data, options);
}

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
export async function importFromLangSmith(
  client: AIEvalClient,
  langsmithData: any,
  options: ImportOptions
): Promise<ImportResult> {
  // Transform LangSmith format to our format
  const transformedData: ExportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      format: 'json',
      organizationId: options.organizationId
    },
    traces: []
  };

  // Transform runs to traces
  if (langsmithData.runs && Array.isArray(langsmithData.runs)) {
    transformedData.traces = langsmithData.runs.map((run: any) => ({
      name: run.name || 'Imported Trace',
      traceId: run.id || `langsmith-${Date.now()}-${Math.random()}`,
      organizationId: options.organizationId!,
      status: run.error ? 'error' : 'success',
      durationMs: run.execution_time ? Math.round(run.execution_time * 1000) : null,
      metadata: {
        source: 'langsmith',
        original_id: run.id,
        inputs: run.inputs,
        outputs: run.outputs
      },
      createdAt: run.start_time || new Date().toISOString()
    }));
  }

  return importData(client, transformedData, options);
}

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
export function convertToCSV(data: ExportData, type: 'traces' | 'evaluations'): string {
  const items = type === 'traces' ? data.traces : data.evaluations;
  if (!items || items.length === 0) return '';

  // Get headers from first item
  const headers = Object.keys(items[0]);
  const rows = items.map(item => 
    headers.map(h => {
      const value = (item as any)[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}