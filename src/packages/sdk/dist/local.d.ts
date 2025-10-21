/**
 * Local Development Mode (Tier 2.10)
 * Offline mode with local storage for development
 *
 * ⚠️ NOTE: This module requires Node.js and will not work in browsers.
 */
import type { Trace, Evaluation, Span } from './types';
export interface LocalStorageOptions {
    directory?: string;
    autoSave?: boolean;
}
export declare class LocalStorage {
    private directory;
    private autoSave;
    private traces;
    private evaluations;
    private spans;
    constructor(options?: LocalStorageOptions);
    private initialize;
    private loadAllData;
    private saveTraceToDisk;
    saveTrace(trace: Trace): Promise<void>;
    getTrace(id: string): Promise<Trace | undefined>;
    listTraces(): Promise<Trace[]>;
    private saveEvaluationToDisk;
    saveEvaluation(evaluation: Evaluation): Promise<void>;
    getEvaluation(id: string): Promise<Evaluation | undefined>;
    listEvaluations(): Promise<Evaluation[]>;
    private saveSpansToDisk;
    saveSpans(traceId: string, spans: Span[]): Promise<void>;
    getSpans(traceId: string): Promise<Span[] | undefined>;
    clear(): Promise<void>;
    export(format: 'json'): Promise<string>;
    getStats(): {
        traces: number;
        evaluations: number;
        totalSpans: number;
    };
}
