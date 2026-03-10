export type AnalyzeFormat = "human" | "json";
export declare const DEFAULT_LABELED_DATASET_PATH: string;
export interface AnalyzeOptions {
    datasetPath: string;
    format: AnalyzeFormat;
    top: number;
}
export type LabeledOutcome = "pass" | "fail";
export interface LabeledGoldenCase {
    caseId: string;
    input: string;
    expected: string;
    actual: string;
    label: LabeledOutcome;
    failureMode: string | null;
    labeledAt: string;
}
export interface FailureMode {
    mode: string;
    count: number;
    frequency: number;
}
export interface AnalyzeSummary {
    total: number;
    failed: number;
    passRate: number;
    failureModes: FailureMode[];
}
export declare function parseLabeledDataset(content: string): LabeledGoldenCase[];
export declare function analyzeLabeledDataset(rows: LabeledGoldenCase[], top: number): AnalyzeSummary;
export declare function formatAnalyzeHuman(summary: AnalyzeSummary): string;
export declare function runAnalyze(argv: string[]): number;
