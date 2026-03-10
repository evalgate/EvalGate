import { type NormalizedBudgetConfig } from "./config";
export type AutoFormat = "human" | "json";
export type AutoDecision = "plan" | "keep" | "discard" | "investigate";
export type AutoExecutionMode = "plan" | "artifact" | "prompt-edit";
export declare const DEFAULT_AUTO_REPORT_PATH: string;
export interface AutoOptions {
    objective: string | null;
    hypothesis: string | null;
    base: string;
    head: string | null;
    promptPath: string | null;
    budget: number;
    format: AutoFormat;
    outputPath: string;
    dryRun: boolean;
}
export interface AutoDiffSnapshot {
    passRateDelta: number;
    scoreDelta: number;
    regressions: number;
    improvements: number;
    added: number;
    removed: number;
    objectiveFailureModeDelta: number | null;
}
export interface AutoPlanStep {
    iteration: number;
    action: string;
    goal: string;
}
export interface PromptCandidate {
    id: string;
    label: string;
    instruction: string;
}
export interface AutoIterationResult {
    iteration: number;
    candidateId: string;
    label: string;
    runPath: string;
    decision: AutoDecision;
    diff: AutoDiffSnapshot;
    rationale: string[];
}
export interface AutoReport {
    objective: string;
    hypothesis: string | null;
    executionMode: AutoExecutionMode;
    dryRun: boolean;
    iterationBudget: number;
    base: string;
    head: string | null;
    promptPath: string | null;
    impactedSpecIds: string[];
    decision: AutoDecision;
    rationale: string[];
    nextActions: string[];
    executionBudget: {
        mode: NormalizedBudgetConfig["mode"];
        limit: number;
    } | null;
    diff: AutoDiffSnapshot | null;
    planSteps: AutoPlanStep[];
    iterations: AutoIterationResult[];
    generatedAt: string;
    outputPath: string;
}
export interface AutoDecisionInput {
    dryRun: boolean;
    objective: string;
    diff: AutoDiffSnapshot | null;
}
export declare function parseAutoArgs(args: string[]): AutoOptions;
export declare function buildAutoPlan(objective: string, budget: number): AutoPlanStep[];
export declare function generatePromptCandidates(objective: string, hypothesis: string | null, budget: number): PromptCandidate[];
export declare function applyPromptCandidate(originalContent: string, candidate: PromptCandidate): string;
export declare function resolveObjectiveFailureModeDelta(objective: string, failureModes?: Record<string, {
    base: number;
    head: number;
    delta: number;
}>): number | null;
export declare function decideAutoExperiment(input: AutoDecisionInput): {
    decision: AutoDecision;
    rationale: string[];
    nextActions: string[];
};
export declare function buildAutoReport(input: {
    options: AutoOptions;
    executionMode: AutoExecutionMode;
    diff: AutoDiffSnapshot | null;
    executionBudget: AutoReport["executionBudget"];
    impactedSpecIds?: string[];
    iterations?: AutoIterationResult[];
    head?: string | null;
    promptPath?: string | null;
}): AutoReport;
export declare function formatAutoHuman(report: AutoReport): string;
export declare function runAuto(args: string[]): Promise<number>;
