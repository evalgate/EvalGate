/**
 * EvalGate VS Code Extension
 *
 * Provides inline spec pass/fail gutter icons and diagnostics
 * by reading .evalgate/last-run.json and mapping results to source lines.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

interface SpecResult {
	specId: string;
	name: string;
	filePath: string;
	result: {
		status: "passed" | "failed" | "skipped";
		score?: number;
		duration: number;
		error?: string;
	};
}

interface RunResult {
	schemaVersion: number;
	runId: string;
	metadata: {
		startedAt: number;
		completedAt: number;
		duration: number;
	};
	results: SpecResult[];
	summary: {
		passed: number;
		failed: number;
		skipped: number;
		passRate: number;
	};
}

let passDecorationType: vscode.TextEditorDecorationType;
let failDecorationType: vscode.TextEditorDecorationType;
let skipDecorationType: vscode.TextEditorDecorationType;
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
	// Create decoration types for gutter icons
	passDecorationType = vscode.window.createTextEditorDecorationType({
		gutterIconPath: context.asAbsolutePath("icons/pass.svg"),
		gutterIconSize: "contain",
		overviewRulerColor: "green",
		overviewRulerLane: vscode.OverviewRulerLane.Left,
		after: {
			contentText: " ✅",
			color: new vscode.ThemeColor("testing.iconPassed"),
			margin: "0 0 0 1em",
		},
	});

	failDecorationType = vscode.window.createTextEditorDecorationType({
		gutterIconPath: context.asAbsolutePath("icons/fail.svg"),
		gutterIconSize: "contain",
		overviewRulerColor: "red",
		overviewRulerLane: vscode.OverviewRulerLane.Left,
		after: {
			contentText: " ❌",
			color: new vscode.ThemeColor("testing.iconFailed"),
			margin: "0 0 0 1em",
		},
	});

	skipDecorationType = vscode.window.createTextEditorDecorationType({
		gutterIconPath: context.asAbsolutePath("icons/skip.svg"),
		gutterIconSize: "contain",
		overviewRulerColor: "yellow",
		overviewRulerLane: vscode.OverviewRulerLane.Left,
		after: {
			contentText: " ⏭️",
			color: new vscode.ThemeColor("testing.iconSkipped"),
			margin: "0 0 0 1em",
		},
	});

	// Create diagnostic collection
	diagnosticCollection =
		vscode.languages.createDiagnosticCollection("evalgate");

	// Create status bar
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100,
	);
	statusBarItem.command = "evalgate.showLastRun";
	context.subscriptions.push(statusBarItem);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand("evalgate.runAll", runAllSpecs),
		vscode.commands.registerCommand("evalgate.runFile", runFileSpecs),
		vscode.commands.registerCommand("evalgate.discover", discoverSpecs),
		vscode.commands.registerCommand("evalgate.showLastRun", showLastRun),
	);

	// Watch for run result changes
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		const pattern = new vscode.RelativePattern(
			workspaceFolders[0],
			".evalgate/last-run.json",
		);
		fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => refreshDecorations());
		fileWatcher.onDidCreate(() => refreshDecorations());
		context.subscriptions.push(fileWatcher);
	}

	// Initial decoration refresh
	refreshDecorations();

	// Refresh on editor change
	vscode.window.onDidChangeActiveTextEditor(
		() => refreshDecorations(),
		null,
		context.subscriptions,
	);
}

/**
 * Load the last run results
 */
function loadLastRun(): RunResult | null {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return null;

	const lastRunPath = path.join(
		workspaceFolders[0].uri.fsPath,
		".evalgate",
		"last-run.json",
	);

	if (!fs.existsSync(lastRunPath)) return null;

	try {
		const content = fs.readFileSync(lastRunPath, "utf-8");
		return JSON.parse(content) as RunResult;
	} catch {
		return null;
	}
}

/**
 * Refresh gutter decorations based on last run
 */
function refreshDecorations() {
	const config = vscode.workspace.getConfiguration("evalgate");
	if (!config.get("showGutterIcons", true)) return;

	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const runResult = loadLastRun();
	if (!runResult) {
		statusBarItem.text = "$(beaker) EvalGate: No runs";
		statusBarItem.show();
		return;
	}

	// Update status bar
	const { passed, failed, skipped } = runResult.summary;
	const icon = failed > 0 ? "$(error)" : "$(check)";
	statusBarItem.text = `${icon} EvalGate: ${passed}/${passed + failed + skipped} passed`;
	statusBarItem.tooltip = `Run ${runResult.runId}\nDuration: ${runResult.metadata.duration}ms\nPass rate: ${(runResult.summary.passRate * 100).toFixed(1)}%`;
	statusBarItem.show();

	// Find specs matching current file
	const currentFile = editor.document.uri.fsPath;
	const workspaceRoot =
		vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

	const matchingSpecs = runResult.results.filter((spec) => {
		const specAbsPath = path.isAbsolute(spec.filePath)
			? spec.filePath
			: path.join(workspaceRoot, spec.filePath);
		return path.normalize(specAbsPath) === path.normalize(currentFile);
	});

	if (matchingSpecs.length === 0) {
		editor.setDecorations(passDecorationType, []);
		editor.setDecorations(failDecorationType, []);
		editor.setDecorations(skipDecorationType, []);
		return;
	}

	// Find defineEval calls in the current document to map results to lines
	const text = editor.document.getText();
	const defineEvalRegex = /defineEval\s*\(\s*["'`]([^"'`]+)["'`]/g;
	const specPositions = new Map<string, number>();

	for (
		let match = defineEvalRegex.exec(text);
		match !== null;
		match = defineEvalRegex.exec(text)
	) {
		const name = match[1];
		const line = editor.document.positionAt(match.index).line;
		specPositions.set(name, line);
	}

	const passDecorations: vscode.DecorationOptions[] = [];
	const failDecorations: vscode.DecorationOptions[] = [];
	const skipDecorations: vscode.DecorationOptions[] = [];
	const diagnostics: vscode.Diagnostic[] = [];

	for (const spec of matchingSpecs) {
		const line = specPositions.get(spec.name);
		if (line === undefined) continue;

		const range = new vscode.Range(line, 0, line, 0);
		const scoreText =
			spec.result.score !== undefined
				? ` (${(spec.result.score * 100).toFixed(0)}%)`
				: "";
		const durationText = ` ${spec.result.duration}ms`;

		const decoration: vscode.DecorationOptions = {
			range,
			hoverMessage: new vscode.MarkdownString(
				`**${spec.name}**: ${spec.result.status}${scoreText}${durationText}${spec.result.error ? `\n\nError: ${spec.result.error}` : ""}`,
			),
		};

		switch (spec.result.status) {
			case "passed":
				passDecorations.push(decoration);
				break;
			case "failed":
				failDecorations.push(decoration);
				diagnostics.push(
					new vscode.Diagnostic(
						range,
						`EvalGate: "${spec.name}" failed${spec.result.error ? `: ${spec.result.error}` : ""}`,
						vscode.DiagnosticSeverity.Error,
					),
				);
				break;
			case "skipped":
				skipDecorations.push(decoration);
				break;
		}
	}

	editor.setDecorations(passDecorationType, passDecorations);
	editor.setDecorations(failDecorationType, failDecorations);
	editor.setDecorations(skipDecorationType, skipDecorations);

	if (config.get("showInlineAnnotations", true)) {
		diagnosticCollection.set(editor.document.uri, diagnostics);
	}
}

/**
 * Run all specs via terminal
 */
async function runAllSpecs() {
	const terminal = vscode.window.createTerminal("EvalGate");
	terminal.sendText("npx evalgate run --write-results");
	terminal.show();
}

/**
 * Run specs in the current file
 */
async function runFileSpecs() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage("No active editor");
		return;
	}

	const terminal = vscode.window.createTerminal("EvalGate");
	terminal.sendText(
		`npx evalgate run --write-results --spec-ids "$(npx evalgate discover --manifest 2>/dev/null && cat .evalgate/manifest.json | node -e 'const m=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));const f="${editor.document.uri.fsPath}";console.log(m.specs.filter(s=>s.filePath.includes(require("path").basename(f))).map(s=>s.id).join(","))')"`,
	);
	terminal.show();
}

/**
 * Run discover command
 */
async function discoverSpecs() {
	const terminal = vscode.window.createTerminal("EvalGate");
	terminal.sendText("npx evalgate discover --manifest");
	terminal.show();
}

/**
 * Show last run results in output panel
 */
async function showLastRun() {
	const runResult = loadLastRun();
	if (!runResult) {
		vscode.window.showInformationMessage(
			"No EvalGate run results found. Run `evalgate run --write-results` first.",
		);
		return;
	}

	const outputChannel = vscode.window.createOutputChannel("EvalGate Results");
	outputChannel.clear();
	outputChannel.appendLine(`EvalGate Run: ${runResult.runId}`);
	outputChannel.appendLine(`Duration: ${runResult.metadata.duration}ms`);
	outputChannel.appendLine(
		`Pass Rate: ${(runResult.summary.passRate * 100).toFixed(1)}%`,
	);
	outputChannel.appendLine("");
	outputChannel.appendLine(
		`Passed: ${runResult.summary.passed} | Failed: ${runResult.summary.failed} | Skipped: ${runResult.summary.skipped}`,
	);
	outputChannel.appendLine("");

	for (const spec of runResult.results) {
		const icon =
			spec.result.status === "passed"
				? "✅"
				: spec.result.status === "failed"
					? "❌"
					: "⏭️";
		const score =
			spec.result.score !== undefined
				? ` (${(spec.result.score * 100).toFixed(0)}%)`
				: "";
		outputChannel.appendLine(
			`${icon} ${spec.name}${score} [${spec.result.duration}ms]`,
		);
		if (spec.result.error) {
			outputChannel.appendLine(`   Error: ${spec.result.error}`);
		}
	}

	outputChannel.show();
}

export function deactivate() {
	if (fileWatcher) fileWatcher.dispose();
	diagnosticCollection.dispose();
	statusBarItem.dispose();
}
