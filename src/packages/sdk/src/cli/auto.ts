import {
	runAutoDaemon,
	runAutoHistory,
	runAutoInit,
	runAutoRun,
} from "./auto-commands";
import { runLegacyAuto } from "./auto-runner";

export {
	type AutoDecision,
	type AutoDecisionInput,
	type AutoDiffSnapshot,
	type AutoExecutionMode,
	type AutoFormat,
	type AutoIterationResult,
	type AutoOptions,
	type AutoPlanStep,
	type AutoReport,
	applyPromptCandidate,
	buildAutoPlan,
	buildAutoReport,
	DEFAULT_AUTO_REPORT_PATH,
	decideAutoExperiment,
	formatAutoHuman,
	generatePromptCandidates,
	type PromptCandidate,
	parseAutoArgs,
	runLegacyAuto,
} from "./auto-runner";

export async function runAuto(args: string[]): Promise<number> {
	const subcommand = args[0];
	if (!subcommand || subcommand.startsWith("--")) {
		return runLegacyAuto(args);
	}
	if (subcommand === "init") {
		return runAutoInit(args.slice(1));
	}
	if (subcommand === "run") {
		return runAutoRun(args.slice(1));
	}
	if (subcommand === "daemon") {
		return runAutoDaemon(args.slice(1));
	}
	if (subcommand === "history") {
		return runAutoHistory(args.slice(1));
	}
	console.error(`EvalGate auto ERROR: unknown subcommand '${subcommand}'`);
	return 1;
}
