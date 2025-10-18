"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exportData;
exports.importData = importData;
exports.exportToFile = exportToFile;
exports.importFromFile = importFromFile;
exports.importFromLangSmith = importFromLangSmith;
exports.convertToCSV = convertToCSV;
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
async function exportData(client, options) {
    const exportData = {
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
            const allTestCases = [];
            for (const evaluation of evaluations) {
                const testCases = await client.evaluations.listTestCases(evaluation.id);
                allTestCases.push(...testCases);
            }
            exportData.testCases = allTestCases;
        }
        // Export runs for each evaluation
        if (options.includeRuns) {
            const allRuns = [];
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
async function importData(client, data, options) {
    const result = {
        summary: { total: 0, imported: 0, skipped: 0, failed: 0 },
        details: {},
        errors: []
    };
    if (options.dryRun) {
        // Count what would be imported
        if (data.traces)
            result.summary.total += data.traces.length;
        if (data.evaluations)
            result.summary.total += data.evaluations.length;
        if (data.testCases)
            result.summary.total += data.testCases.length;
        if (data.runs)
            result.summary.total += data.runs.length;
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
            }
            catch (error) {
                if (options.skipDuplicates && error instanceof Error && error.message.includes('already exists')) {
                    traceResults.skipped++;
                    result.summary.skipped++;
                }
                else {
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
            }
            catch (error) {
                if (options.skipDuplicates && error instanceof Error && error.message.includes('already exists')) {
                    evalResults.skipped++;
                    result.summary.skipped++;
                }
                else {
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
async function exportToFile(client, filePath, options) {
    const data = await exportData(client, { ...options, format: 'json' });
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
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
async function importFromFile(client, filePath, options) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
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
async function importFromLangSmith(client, langsmithData, options) {
    // Transform LangSmith format to our format
    const transformedData = {
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
        transformedData.traces = langsmithData.runs.map((run) => ({
            name: run.name || 'Imported Trace',
            traceId: run.id || `langsmith-${Date.now()}-${Math.random()}`,
            organizationId: options.organizationId,
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
function convertToCSV(data, type) {
    const items = type === 'traces' ? data.traces : data.evaluations;
    if (!items || items.length === 0)
        return '';
    // Get headers from first item
    const headers = Object.keys(items[0]);
    const rows = items.map(item => headers.map(h => {
        const value = item[h];
        if (value === null || value === undefined)
            return '';
        if (typeof value === 'object')
            return JSON.stringify(value);
        return String(value);
    }).join(','));
    return [headers.join(','), ...rows].join('\n');
}
