"use strict";
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
exports.DEFAULT_AUTO_REPORT_PATH = void 0;
exports.parseAutoArgs = parseAutoArgs;
exports.buildAutoPlan = buildAutoPlan;
exports.generatePromptCandidates = generatePromptCandidates;
exports.applyPromptCandidate = applyPromptCandidate;
exports.resolveObjectiveFailureModeDelta = resolveObjectiveFailureModeDelta;
exports.decideAutoExperiment = decideAutoExperiment;
exports.buildAutoReport = buildAutoReport;
exports.formatAutoHuman = formatAutoHuman;
exports.runAuto = runAuto;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const config_1 = require("./config");
const diff_1 = require("./diff");
const impact_analysis_1 = require("./impact-analysis");
const manifest_1 = require("./manifest");
const run_1 = require("./run");
exports.DEFAULT_AUTO_REPORT_PATH = path.join(process.cwd(), ".evalgate", "auto", "latest.json");
function parseAutoArgs(args) {
    const result = {
        objective: null,
        hypothesis: null,
        base: "baseline",
        head: null,
        promptPath: null,
        budget: 3,
        format: "human",
        outputPath: exports.DEFAULT_AUTO_REPORT_PATH,
        dryRun: false,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--objective" && args[i + 1]) {
            result.objective = args[++i];
        }
        else if (arg === "--hypothesis" && args[i + 1]) {
            result.hypothesis = args[++i];
        }
        else if (arg === "--base" && args[i + 1]) {
            result.base = args[++i];
        }
        else if ((arg === "--head" || arg === "--candidate") && args[i + 1]) {
            result.head = args[++i];
        }
        else if (arg === "--prompt" && args[i + 1]) {
            result.promptPath = args[++i];
        }
        else if (arg === "--budget" && args[i + 1]) {
            const parsed = Number.parseInt(args[++i], 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                result.budget = parsed;
            }
        }
        else if (arg === "--format" && args[i + 1]) {
            const format = args[++i];
            if (format === "human" || format === "json") {
                result.format = format;
            }
        }
        else if (arg === "--output" && args[i + 1]) {
            result.outputPath = args[++i];
        }
        else if (arg === "--dry-run") {
            result.dryRun = true;
        }
    }
    return result;
}
function buildAutoPlan(objective, budget) {
    const cappedBudget = Math.max(1, budget);
    const steps = [];
    for (let iteration = 1; iteration <= cappedBudget; iteration++) {
        if (iteration === 1) {
            steps.push({
                iteration,
                action: "propose_change",
                goal: `Target objective '${objective}' with one focused candidate change`,
            });
        }
        else if (iteration === cappedBudget) {
            steps.push({
                iteration,
                action: "decide_keep_or_discard",
                goal: "Compare against baseline and make a final keep/discard decision",
            });
        }
        else {
            steps.push({
                iteration,
                action: "run_and_compare",
                goal: "Execute evals, inspect regressions, and refine the candidate",
            });
        }
    }
    return steps;
}
function detectAutoExecutionMode(options) {
    if (options.promptPath) {
        return "prompt-edit";
    }
    if (options.head) {
        return "artifact";
    }
    return "plan";
}
function generatePromptCandidates(objective, hypothesis, budget) {
    const normalizedObjective = objective.trim();
    const normalizedHypothesis = hypothesis?.trim() ?? "";
    const ideas = new Map();
    if (normalizedHypothesis.length > 0) {
        ideas.set("hypothesis", normalizedHypothesis);
    }
    ideas.set("objective", `Primary optimization target: reduce ${normalizedObjective}. Before answering, explicitly self-check against this objective.`);
    ideas.set("guardrail", `Before finalizing the response, verify it does not introduce regressions outside ${normalizedObjective} and revise if needed.`);
    ideas.set("checklist", `Use a short internal checklist: identify the user need, satisfy required constraints, then confirm the reply avoids ${normalizedObjective}.`);
    const lowerObjective = normalizedObjective.toLowerCase();
    if (lowerObjective.includes("tone")) {
        ideas.set("tone-guide", "Use a calm, empathetic, non-defensive tone. Acknowledge the user's concern before giving the answer.");
    }
    if (lowerObjective.includes("hallucination") ||
        lowerObjective.includes("factual")) {
        ideas.set("uncertainty", "If information is uncertain or missing, say so explicitly instead of inventing details.");
    }
    if (lowerObjective.includes("format")) {
        ideas.set("format-lock", "Return the answer strictly in the requested format and validate that the structure is complete before sending it.");
    }
    if (lowerObjective.includes("constraint") ||
        lowerObjective.includes("policy")) {
        ideas.set("constraint-check", "Before responding, enumerate the required constraints and ensure each one is satisfied in the final answer.");
    }
    if (lowerObjective.includes("safety")) {
        ideas.set("safety-check", "Run a final safety check and refuse or safely redirect unsafe requests before providing the answer.");
    }
    return [...ideas.entries()]
        .slice(0, Math.max(1, budget))
        .map(([id, instruction], index) => ({
        id: `${id}-${index + 1}`,
        label: id,
        instruction,
    }));
}
function stripAutoCandidateBlock(content) {
    return content
        .replace(/\n?\[EvalGate auto start:[^\n]*\]\n[\s\S]*?\n\[EvalGate auto end\]\n?/g, "\n")
        .trimEnd();
}
function applyPromptCandidate(originalContent, candidate) {
    const sanitized = stripAutoCandidateBlock(originalContent);
    return [
        sanitized,
        "",
        `[EvalGate auto start: ${candidate.id} | ${candidate.label}]`,
        candidate.instruction,
        "[EvalGate auto end]",
        "",
    ].join("\n");
}
function resolveObjectiveFailureModeDelta(objective, failureModes) {
    if (!failureModes || Object.keys(failureModes).length === 0) {
        return null;
    }
    const normalizedObjective = objective.trim().toLowerCase();
    if (normalizedObjective.length === 0) {
        return null;
    }
    for (const [mode, stats] of Object.entries(failureModes)) {
        const normalizedMode = mode.toLowerCase();
        if (normalizedObjective === normalizedMode ||
            normalizedObjective.includes(normalizedMode) ||
            normalizedMode.includes(normalizedObjective)) {
            return stats.delta;
        }
    }
    return null;
}
function decideAutoExperiment(input) {
    if (input.dryRun || !input.diff) {
        return {
            decision: "plan",
            rationale: [
                "No candidate run artifact was provided, so EvalGate auto is operating in planning mode.",
                "The loop can define candidate iterations and budget, but it cannot score keep/discard until a candidate run is available.",
            ],
            nextActions: [
                "Generate or run one candidate change against the target objective.",
                "Re-run evalgate auto with --head <candidate-run.json> or --prompt <path> to score the iteration.",
            ],
        };
    }
    const rationale = [];
    const nextActions = [];
    const objectiveDelta = input.diff.objectiveFailureModeDelta;
    if (objectiveDelta !== null) {
        if (objectiveDelta < 0) {
            rationale.push(`Target failure mode improved by ${Math.abs(objectiveDelta)} case(s) relative to baseline.`);
        }
        else if (objectiveDelta > 0) {
            rationale.push(`Target failure mode worsened by ${objectiveDelta} case(s) relative to baseline.`);
        }
        else {
            rationale.push("Target failure mode is unchanged relative to baseline.");
        }
    }
    if (input.diff.regressions > input.diff.improvements &&
        input.diff.regressions > 0) {
        rationale.push(`Regressions (${input.diff.regressions}) outnumber improvements (${input.diff.improvements}).`);
        nextActions.push("Revert or narrow the candidate change.");
        nextActions.push("Inspect the top regressions before trying another iteration.");
        return { decision: "discard", rationale, nextActions };
    }
    if (objectiveDelta !== null && objectiveDelta > 0) {
        rationale.push("The candidate moves the objective in the wrong direction.");
        nextActions.push("Discard this candidate and try a new hypothesis.");
        return { decision: "discard", rationale, nextActions };
    }
    if (input.diff.regressions === 0 &&
        input.diff.passRateDelta >= 0 &&
        (objectiveDelta === null || objectiveDelta <= 0) &&
        (input.diff.improvements > 0 ||
            input.diff.scoreDelta > 0 ||
            objectiveDelta !== null)) {
        rationale.push("No regressions were detected and aggregate quality did not decline.");
        nextActions.push("Keep this candidate and use it as the new baseline for the next iteration.");
        if (objectiveDelta === null) {
            nextActions.push("Add failure-mode labeling coverage if you want objective-specific gating.");
        }
        return { decision: "keep", rationale, nextActions };
    }
    if (input.diff.passRateDelta < 0) {
        rationale.push(`Pass rate declined by ${(input.diff.passRateDelta * 100).toFixed(1)} percentage points.`);
    }
    if (input.diff.improvements === 0 && input.diff.regressions === 0) {
        rationale.push("The candidate did not create a strong measurable behavioral change.");
    }
    if (objectiveDelta === null) {
        rationale.push("The objective could not be tied to a labeled failure mode delta, so the result needs human review.");
    }
    if (nextActions.length === 0) {
        nextActions.push("Inspect the diff summary and decide whether to refine or rerun the candidate.");
        nextActions.push("Prefer smaller, more targeted changes for the next iteration.");
    }
    return { decision: "investigate", rationale, nextActions };
}
function diffSnapshotFromReports(objective, base, head) {
    const result = (0, diff_1.compareReports)(base, head);
    return {
        passRateDelta: result.summary.passRateDelta,
        scoreDelta: result.summary.scoreDelta,
        regressions: result.summary.regressions,
        improvements: result.summary.improvements,
        added: result.summary.added,
        removed: result.summary.removed,
        objectiveFailureModeDelta: resolveObjectiveFailureModeDelta(objective, result.summary.failureModes),
    };
}
function scoreIteration(snapshot, decision) {
    let score = snapshot.improvements * 40 - snapshot.regressions * 100;
    score += snapshot.passRateDelta * 1000;
    score += snapshot.scoreDelta * 800;
    if (snapshot.objectiveFailureModeDelta !== null) {
        score += -snapshot.objectiveFailureModeDelta * 60;
    }
    if (decision === "keep") {
        score += 200;
    }
    else if (decision === "discard") {
        score -= 200;
    }
    return score;
}
function normalizeWorkspacePath(filePath, projectRoot) {
    return path
        .relative(projectRoot, path.resolve(projectRoot, filePath))
        .replace(/\\/g, "/");
}
function resolvePromptSelection(manifest, projectRoot, explicitPromptPath) {
    if (explicitPromptPath) {
        const absolutePath = path.isAbsolute(explicitPromptPath)
            ? explicitPromptPath
            : path.join(projectRoot, explicitPromptPath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Prompt file not found: ${explicitPromptPath}`);
        }
        return {
            absolutePath,
            relativePath: normalizeWorkspacePath(absolutePath, projectRoot),
        };
    }
    const promptPaths = [
        ...new Set(manifest.specs.flatMap((spec) => spec.dependsOn.prompts)),
    ];
    if (promptPaths.length !== 1) {
        throw new Error("Pass --prompt <path> to run the live auto loop, because the manifest does not resolve to exactly one prompt dependency.");
    }
    const absolutePath = path.join(projectRoot, promptPaths[0]);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Prompt file not found: ${promptPaths[0]}`);
    }
    return {
        absolutePath,
        relativePath: promptPaths[0],
    };
}
function persistAutoRunArtifact(result, label, projectRoot) {
    const runsDir = path.join(projectRoot, ".evalgate", "auto", "runs");
    fs.mkdirSync(runsDir, { recursive: true });
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const runPath = path.join(runsDir, `${safeLabel}-${result.runId}.json`);
    fs.writeFileSync(runPath, JSON.stringify(result, null, 2), "utf8");
    return runPath;
}
async function executePromptLoop(options, manifest, projectRoot) {
    const promptSelection = resolvePromptSelection(manifest, projectRoot, options.promptPath);
    const impact = (0, impact_analysis_1.analyzeImpact)([promptSelection.relativePath], manifest);
    if (impact.impactedSpecIds.length === 0) {
        throw new Error(`No impacted specs found for prompt file ${promptSelection.relativePath}`);
    }
    const originalContent = fs.readFileSync(promptSelection.absolutePath, "utf8");
    const baselineRun = await (0, run_1.runEvaluations)({
        specIds: impact.impactedSpecIds,
        format: "json",
        writeResults: false,
    }, projectRoot);
    persistAutoRunArtifact(baselineRun, "baseline", projectRoot);
    const candidates = generatePromptCandidates(options.objective ?? "", options.hypothesis, options.budget);
    const iterations = [];
    let bestKeep = null;
    let bestOverall = null;
    try {
        for (const [index, candidate] of candidates.entries()) {
            const candidateContent = applyPromptCandidate(originalContent, candidate);
            fs.writeFileSync(promptSelection.absolutePath, candidateContent, "utf8");
            try {
                const candidateRun = await (0, run_1.runEvaluations)({
                    specIds: impact.impactedSpecIds,
                    format: "json",
                    writeResults: false,
                }, projectRoot);
                const runPath = persistAutoRunArtifact(candidateRun, `iter-${index + 1}-${candidate.id}`, projectRoot);
                const snapshot = diffSnapshotFromReports(options.objective ?? "", baselineRun, candidateRun);
                const iterationDecision = decideAutoExperiment({
                    dryRun: false,
                    objective: options.objective ?? "",
                    diff: snapshot,
                });
                const iterationResult = {
                    iteration: index + 1,
                    candidateId: candidate.id,
                    label: candidate.label,
                    runPath,
                    decision: iterationDecision.decision,
                    diff: snapshot,
                    rationale: iterationDecision.rationale,
                };
                iterations.push(iterationResult);
                const score = scoreIteration(snapshot, iterationDecision.decision);
                if (!bestOverall || score > bestOverall.score) {
                    bestOverall = {
                        score,
                        result: iterationResult,
                        content: candidateContent,
                    };
                }
                if (iterationDecision.decision === "keep" &&
                    (!bestKeep || score > bestKeep.score)) {
                    bestKeep = {
                        score,
                        result: iterationResult,
                        content: candidateContent,
                    };
                }
            }
            catch (error) {
                iterations.push({
                    iteration: index + 1,
                    candidateId: candidate.id,
                    label: candidate.label,
                    runPath: "",
                    decision: "discard",
                    diff: {
                        passRateDelta: -1,
                        scoreDelta: -1,
                        regressions: impact.impactedSpecIds.length,
                        improvements: 0,
                        added: 0,
                        removed: 0,
                        objectiveFailureModeDelta: null,
                    },
                    rationale: [
                        `Iteration failed to execute: ${error instanceof Error ? error.message : String(error)}`,
                    ],
                });
            }
            finally {
                fs.writeFileSync(promptSelection.absolutePath, originalContent, "utf8");
            }
        }
    }
    finally {
        fs.writeFileSync(promptSelection.absolutePath, originalContent, "utf8");
    }
    if (bestKeep) {
        fs.writeFileSync(promptSelection.absolutePath, bestKeep.content, "utf8");
        return {
            diff: bestKeep.result.diff,
            impactedSpecIds: impact.impactedSpecIds,
            iterations,
            head: bestKeep.result.runPath,
            promptPath: promptSelection.relativePath,
        };
    }
    return {
        diff: bestOverall?.result.diff ?? null,
        impactedSpecIds: impact.impactedSpecIds,
        iterations,
        head: bestOverall?.result.runPath ?? null,
        promptPath: promptSelection.relativePath,
    };
}
function buildAutoReport(input) {
    const objective = input.options.objective ?? "";
    const decision = decideAutoExperiment({
        dryRun: input.options.dryRun || input.executionMode === "plan",
        objective,
        diff: input.diff,
    });
    return {
        objective,
        hypothesis: input.options.hypothesis,
        executionMode: input.executionMode,
        dryRun: input.options.dryRun || input.executionMode === "plan",
        iterationBudget: input.options.budget,
        base: input.options.base,
        head: input.head ?? input.options.head,
        promptPath: input.promptPath ?? input.options.promptPath,
        impactedSpecIds: input.impactedSpecIds ?? [],
        decision: decision.decision,
        rationale: decision.rationale,
        nextActions: decision.nextActions,
        executionBudget: input.executionBudget,
        diff: input.diff,
        planSteps: buildAutoPlan(objective, input.options.budget),
        iterations: input.iterations ?? [],
        generatedAt: new Date().toISOString(),
        outputPath: input.options.outputPath,
    };
}
function formatAutoHuman(report) {
    const lines = [
        "Auto phase",
        `Objective: ${report.objective}`,
        `Decision: ${report.decision.toUpperCase()}`,
        `Execution mode: ${report.executionMode}`,
        `Mode: ${report.dryRun ? "plan" : "evaluate"}`,
        `Iteration budget: ${report.iterationBudget}`,
        `Base: ${report.base}`,
        `Head: ${report.head ?? "(not provided)"}`,
    ];
    if (report.promptPath) {
        lines.push(`Prompt: ${report.promptPath}`);
    }
    if (report.impactedSpecIds.length > 0) {
        lines.push(`Impacted specs: ${report.impactedSpecIds.join(", ")}`);
    }
    if (report.executionBudget) {
        lines.push(`Execution budget: ${report.executionBudget.mode} limit ${report.executionBudget.limit}`);
    }
    if (report.diff) {
        lines.push(`Diff: ${report.diff.regressions} regressions, ${report.diff.improvements} improvements, ${(report.diff.passRateDelta * 100).toFixed(1)}pp pass-rate delta`);
        if (report.diff.objectiveFailureModeDelta !== null) {
            lines.push(`Objective failure-mode delta: ${report.diff.objectiveFailureModeDelta}`);
        }
    }
    if (report.iterations.length > 0) {
        lines.push(`Iterations: ${report.iterations.map((iteration) => `${iteration.iteration}:${iteration.label}:${iteration.decision}`).join(" | ")}`);
    }
    if (report.rationale.length > 0) {
        lines.push(`Rationale: ${report.rationale.join(" ")}`);
    }
    if (report.nextActions.length > 0) {
        lines.push(`Next actions: ${report.nextActions.join(" ")}`);
    }
    return lines.join("\n");
}
function writeAutoReport(report, outputPath) {
    const directory = path.dirname(outputPath);
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
}
async function runAuto(args) {
    const options = parseAutoArgs(args);
    if (!options.objective || options.objective.trim().length === 0) {
        console.error("EvalGate auto ERROR: --objective is required");
        return 1;
    }
    const projectRoot = process.cwd();
    const config = (0, config_1.loadConfig)(projectRoot);
    const executionBudget = config?.normalizedBudget
        ? {
            mode: config.normalizedBudget.mode,
            limit: config.normalizedBudget.mode === "traces"
                ? (config.normalizedBudget.maxTraces ?? 0)
                : (config.normalizedBudget.maxCostUsd ?? 0),
        }
        : null;
    const executionMode = detectAutoExecutionMode(options);
    let diff = null;
    let impactedSpecIds = [];
    let iterations = [];
    let resolvedHead = options.head;
    let resolvedPromptPath = options.promptPath;
    try {
        if (executionMode === "prompt-edit") {
            const manifest = await (0, manifest_1.readManifest)(projectRoot);
            if (!manifest) {
                throw new Error("No evaluation manifest found. Run 'evalgate discover --manifest' first.");
            }
            if (options.dryRun) {
                const promptSelection = resolvePromptSelection(manifest, projectRoot, options.promptPath);
                resolvedPromptPath = promptSelection.relativePath;
                impactedSpecIds = (0, impact_analysis_1.analyzeImpact)([promptSelection.relativePath], manifest).impactedSpecIds;
            }
            else {
                const loopResult = await executePromptLoop(options, manifest, projectRoot);
                diff = loopResult.diff;
                impactedSpecIds = loopResult.impactedSpecIds;
                iterations = loopResult.iterations;
                resolvedHead = loopResult.head;
                resolvedPromptPath = loopResult.promptPath;
            }
        }
        else if (!options.dryRun && options.head) {
            const result = await (0, diff_1.runDiff)({
                base: options.base,
                head: options.head,
                format: "json",
            });
            diff = {
                passRateDelta: result.summary.passRateDelta,
                scoreDelta: result.summary.scoreDelta,
                regressions: result.summary.regressions,
                improvements: result.summary.improvements,
                added: result.summary.added,
                removed: result.summary.removed,
                objectiveFailureModeDelta: resolveObjectiveFailureModeDelta(options.objective, result.summary.failureModes),
            };
        }
    }
    catch (error) {
        console.error(`EvalGate auto ERROR: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
    }
    const report = buildAutoReport({
        options,
        executionMode,
        diff,
        executionBudget,
        impactedSpecIds,
        iterations,
        head: resolvedHead,
        promptPath: resolvedPromptPath,
    });
    try {
        writeAutoReport(report, options.outputPath);
    }
    catch (error) {
        console.error(`EvalGate auto ERROR: ${error instanceof Error ? error.message : String(error)}`);
        return 3;
    }
    if (options.format === "json") {
        console.log(JSON.stringify(report, null, 2));
    }
    else {
        console.log(formatAutoHuman(report));
        console.log(`\nSaved → ${path.relative(projectRoot, options.outputPath)}`);
    }
    return 0;
}
