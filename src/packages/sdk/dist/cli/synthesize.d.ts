import { type LabeledGoldenCase } from "./analyze";
export type SynthesizeFormat = "human" | "json";
export declare const DEFAULT_SYNTHETIC_DATASET_PATH: string;
export interface SynthesizeOptions {
    datasetPath: string;
    dimensionsPath: string | null;
    outputPath: string;
    format: SynthesizeFormat;
    count: number | null;
    failureModes: string[];
}
export interface SyntheticGoldenCase extends LabeledGoldenCase {
    synthetic: true;
    synthesizedAt: string;
    sourceCaseIds: string[];
    dimensions: Record<string, string>;
}
export interface SynthesizeSummary {
    sourceCases: number;
    sourceFailures: number;
    selectedFailureModes: string[];
    dimensionNames: string[];
    dimensionCombinationCount: number;
    generated: number;
    modeCounts: Array<{
        failureMode: string;
        count: number;
    }>;
    outputPath: string;
    cases: SyntheticGoldenCase[];
}
export interface DimensionMatrix {
    dimensions: Record<string, string[]>;
}
export declare function parseSynthesizeArgs(argv: string[]): SynthesizeOptions;
export declare function parseDimensionMatrix(content: string): DimensionMatrix;
export declare function synthesizeLabeledDataset(rows: LabeledGoldenCase[], options?: {
    dimensions?: Record<string, string[]>;
    count?: number | null;
    failureModes?: string[];
    outputPath?: string;
}): SynthesizeSummary;
export declare function formatSynthesizeHuman(summary: SynthesizeSummary): string;
export declare function runSynthesize(argv: string[]): number;
