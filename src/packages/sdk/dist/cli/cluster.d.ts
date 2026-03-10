import { type RunResult } from "./run";
export type ClusterFormat = "human" | "json";
export interface ClusterFlags {
    runPath: string | null;
    outputPath: string | null;
    format: ClusterFormat;
    clusters: number | null;
    includePassed: boolean;
}
export interface ClusterSample {
    caseId: string;
    name: string;
}
export interface TraceCluster {
    id: string;
    label: string;
    keywords: string[];
    memberIds: string[];
    memberCount: number;
    density: number;
    statusCounts: {
        passed: number;
        failed: number;
        skipped: number;
    };
    samples: ClusterSample[];
}
export interface ClusterSummary {
    runId: string;
    totalRunResults: number;
    clusteredCases: number;
    skippedCases: number;
    requestedClusters: number | null;
    includePassed: boolean;
    clusters: TraceCluster[];
}
export declare function parseClusterArgs(args: string[]): ClusterFlags;
export declare function clusterRunResult(runResult: RunResult, options?: {
    clusters?: number | null;
    includePassed?: boolean;
}): ClusterSummary;
export declare function formatClusterHuman(summary: ClusterSummary): string;
export declare function runCluster(args: string[]): Promise<number>;
