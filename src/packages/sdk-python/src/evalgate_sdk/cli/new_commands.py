"""New CLI commands for Python SDK parity with TypeScript SDK (T5).

Commands: start, watch, compare, validate, promote, replay.
Supporting: templates, profiles, formatters.
"""

from __future__ import annotations

import contextlib
import json
import os
import time
from pathlib import Path
from typing import Any

import typer
from rich.console import Console
from rich.table import Table

console = Console()

# Module-level constants for typer defaults to avoid B008
FILES_ARG = typer.Argument(..., help="Two or more result JSON files to compare")


# ── Gate profile presets ──────────────────────────────────────────────

from evalgate_sdk.cli.profiles import PROFILES  # noqa: E402


# ── Templates ─────────────────────────────────────────────────────────

TEMPLATE_DESCRIPTIONS = {
    "chatbot": "Conversational AI — tone, helpfulness, safety",
    "codegen": "Code generation — syntax, correctness, style",
    "agent": "Multi-step agent — tool use, reasoning, outcomes",
    "safety": "Safety guards — PII, toxicity, hallucination",
    "rag": "RAG pipeline — retrieval faithfulness, grounding",
}

TEMPLATES: dict[str, dict[str, str]] = {
    "chatbot": {
        "eval/chatbot_quality.py": '''"""Chatbot quality evaluation."""
from evalgate_sdk.runtime.eval import define_eval, create_result
from evalgate_sdk.assertions import expect

define_eval("chatbot-responds-helpfully", lambda ctx: _eval_helpful(ctx))

async def _eval_helpful(ctx):
    response = "I'd be happy to help you with that! Here's what I suggest..."
    helpful = expect(response).to_contain_keywords(["help", "suggest"])
    length = expect(response).to_have_length(min=20, max=500)
    all_passed = helpful.passed and length.passed
    return create_result(passed=all_passed, score=100 if all_passed else 40, output=response)
''',
    },
    "codegen": {
        "eval/codegen_accuracy.py": '''"""Code generation accuracy evaluation."""
from evalgate_sdk.runtime.eval import define_eval, create_result
from evalgate_sdk.assertions import has_valid_code_syntax

define_eval("codegen-produces-valid-python", lambda ctx: _eval_codegen(ctx))

async def _eval_codegen(ctx):
    code = "def hello():\\n    return \'Hello, World!\'"
    valid = has_valid_code_syntax(code, "python")
    return create_result(passed=valid, score=100 if valid else 0, output=code)
''',
    },
    "agent": {
        "eval/agent_tool_use.py": '''"""Agent tool-use evaluation."""
from evalgate_sdk.runtime.eval import define_eval, create_result
from evalgate_sdk.assertions import contains_keywords

define_eval("agent-uses-tools-correctly", lambda ctx: _eval_agent(ctx))

async def _eval_agent(ctx):
    output = "I used the search tool to find: The weather is sunny."
    used_tool = contains_keywords(output, ["search", "tool"])
    return create_result(passed=used_tool, score=100 if used_tool else 0, output=output)
''',
    },
    "safety": {
        "eval/safety_checks.py": '''"""Safety guard evaluation."""
from evalgate_sdk.runtime.eval import define_eval, create_result
from evalgate_sdk.assertions import expect

define_eval("no-pii-leak", lambda ctx: _eval_no_pii(ctx))

async def _eval_no_pii(ctx):
    response = "I can help you find information about that topic safely."
    no_pii = expect(response).to_not_contain_pii()
    professional = expect(response).to_be_professional()
    all_passed = no_pii.passed and professional.passed
    return create_result(passed=all_passed, score=100 if all_passed else 0)
''',
    },
    "rag": {
        "eval/rag_faithfulness.py": '''"""RAG faithfulness evaluation."""
from evalgate_sdk.runtime.eval import define_eval, create_result
from evalgate_sdk.assertions import has_no_hallucinations

define_eval("rag-grounded-response", lambda ctx: _eval_rag(ctx))

async def _eval_rag(ctx):
    context_docs = ["Paris is the capital of France."]
    response = "The capital of France is Paris."
    grounded = has_no_hallucinations(response, context_docs)
    return create_result(passed=grounded, score=100 if grounded else 0, output=response)
''',
    },
}


def _install_template(template: str, project_root: str) -> int:
    """Install template files into the project. Returns number of files created."""
    files = TEMPLATES.get(template, {})
    count = 0
    for rel_path, content in files.items():
        full = Path(project_root) / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        if not full.exists():
            full.write_text(content, encoding="utf-8")
            count += 1
    return count


# ── start ─────────────────────────────────────────────────────────────


def start(
    format: str = typer.Option("human", "--format", "-f", help="Output format: human or json"),
    skip_init: bool = typer.Option(False, "--skip-init", help="Skip init if not set up"),
    template: str = typer.Option("", "--template", "-t", help="Starter template to install"),
) -> None:
    """Zero-config startup: one command → init → discover → run."""
    project_root = os.getcwd()

    if format == "human":
        console.print("\n[bold cyan]🚀 evalgate start — zero-config evaluation run[/bold cyan]\n")

    # Step 1: Ensure init
    config_path = Path(project_root) / ".evalgate" / "config.json"
    if not config_path.exists() and not skip_init:
        if format == "human":
            console.print("[yellow]📦 No config found. Initializing...[/yellow]")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "project_name": Path(project_root).name,
                    "eval_dir": "eval",
                    "baseline": ".evalgate/baseline.json",
                },
                indent=2,
            )
        )
        if format == "human":
            console.print("[green]✓ Initialized .evalgate/config.json[/green]")

    # Step 1b: Install template if requested
    if template:
        if template not in TEMPLATES:
            console.print(f"[red]Unknown template: {template}[/red]")
            console.print(f"Available: {', '.join(TEMPLATES.keys())}")
            raise typer.Exit(1)
        count = _install_template(template, project_root)
        if format == "human":
            console.print(f"[green]✓ Installed {template} template ({count} file(s))[/green]")

    # Step 2: Discover specs
    if format == "human":
        console.print("\n[cyan]🔍 Discovering specs...[/cyan]")

    from evalgate_sdk.runtime.execution_mode import get_execution_mode

    mode_config = get_execution_mode(project_root)
    spec_count = len(mode_config.spec_files)

    if format == "human":
        console.print(f"[dim]Found {spec_count} spec file(s) in {mode_config.mode} mode[/dim]")

    if spec_count == 0:
        if format == "human":
            console.print(
                "[yellow]No spec files found. Create eval files with define_eval() or use --template.[/yellow]"
            )
        raise typer.Exit(0)

    if format == "human":
        console.print("\n[green]✓ Ready to run evaluations[/green]")
        console.print("[dim]Use 'evalgate run' to execute specs[/dim]")


# ── watch ─────────────────────────────────────────────────────────────


def watch(
    eval_dir: str = typer.Option("eval", "--eval-dir", "-e", help="Directory to watch"),
    debounce_ms: int = typer.Option(300, "--debounce", help="Debounce interval in ms"),
    clear_screen: bool = typer.Option(True, "--clear/--no-clear", help="Clear screen between runs"),
) -> None:
    """Watch mode — re-run evaluations when source files change."""
    import importlib.util

    project_root = os.getcwd()
    watch_dir = Path(project_root) / eval_dir

    if not watch_dir.exists():
        console.print(f"[red]Watch directory not found: {watch_dir}[/red]")
        raise typer.Exit(1)

    console.print(f"[cyan]👁️  Watching {watch_dir} (debounce: {debounce_ms}ms)[/cyan]")
    console.print("[dim]Press Ctrl+C to stop[/dim]\n")

    last_mtimes: dict[str, float] = {}

    def _get_mtimes() -> dict[str, float]:
        mtimes: dict[str, float] = {}
        for f in watch_dir.rglob("*.py"):
            if f.name.startswith("_"):
                continue
            with contextlib.suppress(OSError):
                mtimes[str(f)] = f.stat().st_mtime
        return mtimes

    def _run_specs() -> None:
        console.print(f"[cyan]▶ Running specs at {time.strftime('%H:%M:%S')}...[/cyan]")
        try:
            from evalgate_sdk.runtime.registry import create_eval_runtime

            handle = create_eval_runtime("watch-mode")
            for f in sorted(watch_dir.rglob("*.py")):
                if f.name.startswith("_"):
                    continue
                try:
                    spec = importlib.util.spec_from_file_location(f.stem, f)
                    if spec and spec.loader:
                        mod = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(mod)
                except Exception as exc:
                    console.print(f"[red]Error loading {f.name}: {exc}[/red]")
            specs = handle.runtime.list()
            console.print(f"[green]✓ Discovered {len(specs)} spec(s)[/green]")
            handle.dispose()
        except Exception as exc:
            console.print(f"[red]Run error: {exc}[/red]")

    # Initial run
    last_mtimes = _get_mtimes()
    _run_specs()

    try:
        while True:
            time.sleep(debounce_ms / 1000.0)
            current = _get_mtimes()
            if current != last_mtimes:
                last_mtimes = current
                if clear_screen:
                    os.system("cls" if os.name == "nt" else "clear")
                _run_specs()
    except KeyboardInterrupt:
        console.print("\n[yellow]Watch mode stopped.[/yellow]")


# ── compare ───────────────────────────────────────────────────────────


def compare(
    files: list[str] = FILES_ARG,
    format: str = typer.Option("human", "--format", "-f", help="Output format"),
) -> None:
    """Compare evaluation result files."""
    """Compare results from multiple evaluation runs side-by-side."""
    if len(files) < 2:
        console.print("[red]Need at least 2 result files to compare.[/red]")
        raise typer.Exit(1)

    runs: list[dict[str, Any]] = []
    for f in files:
        p = Path(f)
        if not p.exists():
            console.print(f"[red]File not found: {f}[/red]")
            raise typer.Exit(1)
        runs.append(json.loads(p.read_text(encoding="utf-8")))

    if format == "json":
        console.print_json(json.dumps({"runs": runs}))
        return

    table = Table(title="Run Comparison")
    table.add_column("Metric", style="cyan")
    for _i, f in enumerate(files):
        table.add_column(Path(f).stem, justify="right")

    # Extract common metrics
    metrics = ["total", "passed", "failed", "pass_rate", "average_score", "total_duration_ms"]
    for metric in metrics:
        row = [metric]
        for run_data in runs:
            summary = run_data.get("summary", {})
            val = summary.get(metric, "-")
            if isinstance(val, float):
                row.append(f"{val:.2f}")
            else:
                row.append(str(val))
        table.add_row(*row)

    console.print(table)


# ── validate ──────────────────────────────────────────────────────────


def validate(
    eval_dir: str = typer.Option("eval", "--eval-dir", "-e", help="Directory containing spec files"),
) -> None:
    """Validate spec files without running them."""
    import importlib.util

    project_root = os.getcwd()
    eval_path = Path(project_root) / eval_dir

    if not eval_path.exists():
        console.print(f"[red]Eval directory not found: {eval_path}[/red]")
        raise typer.Exit(1)

    from evalgate_sdk.runtime.registry import create_eval_runtime

    handle = create_eval_runtime("validate")
    errors: list[str] = []
    file_count = 0

    for spec_file in sorted(eval_path.rglob("*.py")):
        if spec_file.name.startswith("_"):
            continue
        file_count += 1
        try:
            spec = importlib.util.spec_from_file_location(spec_file.stem, spec_file)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
        except Exception as exc:
            errors.append(f"{spec_file.name}: {exc}")

    specs = handle.runtime.list()
    handle.dispose()

    if errors:
        console.print(f"\n[red]✗ {len(errors)} error(s) in {file_count} file(s):[/red]")
        for err in errors:
            console.print(f"  [red]• {err}[/red]")
        raise typer.Exit(1)

    console.print(f"[green]✓ {len(specs)} spec(s) validated across {file_count} file(s)[/green]")


# ── promote ───────────────────────────────────────────────────────────


def promote(
    candidate_file: str = typer.Argument(..., help="Path to candidate results JSON"),
    baseline_path: str = typer.Option(".evalgate/baseline.json", "--baseline", "-b"),
    min_score: float = typer.Option(90.0, "--min-score", help="Minimum score to promote"),
) -> None:
    """Promote candidate eval cases to the regression baseline."""
    cp = Path(candidate_file)
    if not cp.exists():
        console.print(f"[red]Candidate file not found: {candidate_file}[/red]")
        raise typer.Exit(1)

    candidates = json.loads(cp.read_text(encoding="utf-8"))
    results = candidates.get("results", [])

    bp = Path(baseline_path)
    baseline: dict[str, Any] = {}
    if bp.exists():
        baseline = json.loads(bp.read_text(encoding="utf-8"))

    scores = baseline.get("scores", {})
    promoted = 0
    skipped = 0

    for r in results:
        name = r.get("test_name", r.get("testName", ""))
        score = r.get("score", 0)
        if score >= min_score:
            scores[name] = score
            promoted += 1
        else:
            skipped += 1

    baseline["scores"] = scores
    bp.parent.mkdir(parents=True, exist_ok=True)
    bp.write_text(json.dumps(baseline, indent=2), encoding="utf-8")

    console.print(f"[green]✓ Promoted {promoted} case(s) to baseline[/green]")
    if skipped:
        console.print(f"[yellow]⚠ Skipped {skipped} case(s) below min score ({min_score})[/yellow]")


# ── replay ────────────────────────────────────────────────────────────


def replay(
    result_file: str = typer.Argument(..., help="Path to previous run result JSON"),
    spec_name: str = typer.Option("", "--spec", "-s", help="Replay a specific spec by name"),
) -> None:
    """Replay a previous evaluation run or specific spec."""
    rp = Path(result_file)
    if not rp.exists():
        console.print(f"[red]Result file not found: {result_file}[/red]")
        raise typer.Exit(1)

    data = json.loads(rp.read_text(encoding="utf-8"))
    results = data.get("results", [])

    if spec_name:
        results = [r for r in results if r.get("test_name", r.get("testName", "")) == spec_name]
        if not results:
            console.print(f"[red]No spec named '{spec_name}' found in results.[/red]")
            raise typer.Exit(1)

    table = Table(title="Replay Results")
    table.add_column("Spec", style="cyan")
    table.add_column("Score", justify="right")
    table.add_column("Status")
    table.add_column("Duration (ms)", justify="right")

    for r in results:
        name = r.get("test_name", r.get("testName", "?"))
        score = r.get("score", 0)
        passed = r.get("passed", r.get("pass", False))
        dur = r.get("duration_ms", r.get("durationMs", 0))
        status = "[green]✓ passed[/green]" if passed else "[red]✗ failed[/red]"
        table.add_row(name, f"{score:.1f}", status, f"{dur:.0f}")

    console.print(table)
    console.print(f"\n[dim]{len(results)} result(s) replayed from {rp.name}[/dim]")
