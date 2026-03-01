"""CLI command implementations."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import typer
from rich.console import Console
from rich.table import Table

from evalgate_sdk._version import __version__

console = Console()


def _load_saved_config() -> dict[str, Any]:
    """Load api_key/base_url from .evalgate/config.json if present."""
    config_path = Path.cwd() / ".evalgate" / "config.json"
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text())
            return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}


def _resolve_credentials(
    api_key: str | None,
    base_url: str | None,
) -> tuple[str | None, str | None]:
    """Resolve credentials from flag -> config file (env vars handled by typer envvar=)."""
    if not api_key or not base_url:
        saved = _load_saved_config()
        if not api_key:
            api_key = saved.get("api_key")
        if not base_url:
            base_url = saved.get("base_url")
    return api_key, base_url


def _run_async(coro: Any) -> Any:
    """Run an async function from sync CLI context."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    return loop.run_until_complete(coro)


# ── init ─────────────────────────────────────────────────────────────


def init(
    directory: str = typer.Argument(".", help="Project directory"),
) -> None:
    """Initialize an EvalGate project — creates config, baseline, and CI workflow."""
    cwd = Path(directory).resolve()
    evalai_dir = cwd / ".evalgate"
    evalai_dir.mkdir(exist_ok=True)

    baseline_path = evalai_dir / "baseline.json"
    if not baseline_path.exists():
        baseline_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "scores": {},
                    "latencies": {},
                    "tolerance": {"score_drop": 0.05, "latency_increase_pct": 20.0, "min_confidence": 0.8},
                },
                indent=2,
            )
        )
        console.print(f"[green]✓[/green] Created {baseline_path.relative_to(cwd)}")

    config_path = evalai_dir / "config.json"
    if not config_path.exists():
        config_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "project_name": cwd.name,
                    "eval_dir": "evals",
                    "baseline": str(baseline_path.relative_to(cwd)),
                },
                indent=2,
            )
        )
        console.print(f"[green]✓[/green] Created {config_path.relative_to(cwd)}")

    evals_dir = cwd / "evals"
    evals_dir.mkdir(exist_ok=True)

    example = evals_dir / "example_eval.py"
    if not example.exists():
        example.write_text(
            '"""Example evaluation spec — replace with your LLM call."""\n\n'
            "from evalgate_sdk.runtime import define_eval, create_result, EvalContext\n\n\n"
            "def my_first_eval(ctx: EvalContext):\n"
            "    # Replace this with your actual LLM call\n"
            "    output = ctx.input or 'hello world'\n"
            "    return create_result(passed=len(output) > 0, score=1.0)\n\n\n"
            'define_eval("example-eval", my_first_eval)\n'
        )
        console.print(f"[green]✓[/green] Created {example.relative_to(cwd)}")

    gitignore = cwd / ".gitignore"
    evalai_pattern = ".evalgate/"
    if gitignore.exists():
        content = gitignore.read_text()
        if evalai_pattern not in content:
            with gitignore.open("a") as f:
                if not content.endswith("\n"):
                    f.write("\n")
                f.write(f"{evalai_pattern}\n")
            console.print(f"[green]✓[/green] Added {evalai_pattern} to .gitignore")
    else:
        gitignore.write_text(f"{evalai_pattern}\n")
        console.print(f"[green]✓[/green] Created .gitignore with {evalai_pattern}")

    console.print("\n[bold green]Project initialized![/bold green]")
    console.print("  Next: [cyan]evalai run[/cyan] to execute evaluations")
    console.print("  Docs: https://evalgate.com/docs")


# ── run ──────────────────────────────────────────────────────────────


def run(
    eval_dir: str = typer.Option("evals", "--dir", "-d", help="Eval spec directory"),
    spec_ids: str | None = typer.Option(None, "--spec-ids", help="Comma-separated spec IDs to run"),
    output: str | None = typer.Option(None, "--output", "-o", help="Output file for results"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Run evaluation specs."""
    from evalgate_sdk.runtime import create_eval_runtime, create_local_executor

    cwd = Path.cwd()
    eval_path = cwd / eval_dir

    if not eval_path.exists():
        console.print(f"[red]Error:[/red] Eval directory '{eval_dir}' not found")
        console.print("Run [cyan]evalai init[/cyan] first")
        raise typer.Exit(1)

    handle = create_eval_runtime(str(cwd))
    executor = create_local_executor()

    try:
        # Discover and load specs
        spec_files = list(eval_path.glob("**/*.py"))
        if not spec_files:
            console.print(f"[yellow]No eval specs found in {eval_dir}/[/yellow]")
            raise typer.Exit(0)

        for spec_file in spec_files:
            if spec_file.name.startswith("_"):
                continue
            try:
                import importlib.util

                spec_module = importlib.util.spec_from_file_location(spec_file.stem, spec_file)
                if spec_module and spec_module.loader:
                    mod = importlib.util.module_from_spec(spec_module)
                    spec_module.loader.exec_module(mod)
            except Exception as exc:
                console.print(f"[red]Error loading {spec_file.name}:[/red] {exc}")
                if verbose:
                    import traceback
                    console.print(f"[dim]{traceback.format_exc()}[/dim]")

        specs = handle.runtime.list()
        if spec_ids:
            filter_ids = set(spec_ids.split(","))
            specs = [s for s in specs if s.id in filter_ids or s.name in filter_ids]

        if not specs:
            console.print("[yellow]No matching specs found[/yellow]")
            raise typer.Exit(0)

        console.print(f"\n[bold]Running {len(specs)} eval(s)...[/bold]\n")

        from evalgate_sdk.runtime.types import EvalContext

        results = []
        for spec in specs:
            ctx = EvalContext(input="", metadata={})
            try:
                result = _run_async(executor.execute(spec, ctx))
                status = "[green]✓ PASS[/green]" if result.passed else "[red]✗ FAIL[/red]"
                console.print(f"  {status} {spec.name} ({result.duration_ms:.0f}ms, score={result.score:.2f})")
                entry: dict[str, Any] = {
                    "spec": spec.name,
                    "passed": result.passed,
                    "score": result.score,
                    "duration_ms": result.duration_ms,
                }
                if result.error:
                    entry["error"] = result.error
                if result.status != "passed":
                    entry["status"] = result.status
                results.append(entry)
            except Exception as exc:
                console.print(f"  [red]✗ ERROR[/red] {spec.name}: {exc}")
                results.append({
                    "spec": spec.name,
                    "passed": False,
                    "score": 0.0,
                    "duration_ms": 0.0,
                    "error": str(exc),
                    "status": "error",
                })

        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        console.print(f"\n[bold]{passed}/{total} passed[/bold]")

        if output:
            Path(output).write_text(json.dumps({"results": results}, indent=2))
            console.print(f"Results written to {output}")

        if passed < total:
            raise typer.Exit(1)
    finally:
        handle.dispose()


# ── gate ─────────────────────────────────────────────────────────────


def gate(
    baseline_path: str = typer.Option(".evalgate/baseline.json", "--baseline", "-b", help="Baseline file"),
    report_path: str | None = typer.Option(None, "--report", help="Run report file"),
    min_score: float = typer.Option(0.8, "--min-score", help="Minimum passing score"),
    max_drop: float = typer.Option(0.05, "--max-drop", help="Max allowed score drop"),
) -> None:
    """Run regression gate against a baseline."""
    from evalgate_sdk.regression import GATE_EXIT, Baseline, BaselineTolerance, evaluate_regression

    bp = Path(baseline_path)
    if not bp.exists():
        console.print(f"[red]Baseline not found:[/red] {baseline_path}")
        console.print("Run [cyan]evalai baseline init[/cyan] first")
        raise typer.Exit(GATE_EXIT.INFRA_ERROR)

    raw = json.loads(bp.read_text())
    tol_raw = raw.get("tolerance")
    baseline = Baseline(
        scores=raw.get("scores", {}),
        tolerance=BaselineTolerance(**tol_raw) if isinstance(tol_raw, dict) else BaselineTolerance(),
    )

    current_scores: dict[str, float] = {}
    if report_path:
        rp = Path(report_path)
        if rp.exists():
            report = json.loads(rp.read_text())
            for r in report.get("results", []):
                current_scores[r["spec"]] = r["score"]

    report = evaluate_regression(
        baseline,
        current_scores,
        min_score=min_score if min_score > 0 else None,
        max_drop=max_drop if max_drop > 0 else None,
    )

    table = Table(title="Regression Gate")
    table.add_column("Test", style="cyan")
    table.add_column("Baseline", justify="right")
    table.add_column("Current", justify="right")
    table.add_column("Delta", justify="right")
    table.add_column("Status")

    for d in report.deltas:
        status = "[green]PASS[/green]" if d.category == "pass" else f"[red]{d.severity.upper()}[/red]"
        table.add_row(d.test_id, f"{d.baseline_value:.3f}", f"{d.current_value:.3f}", f"{d.delta:+.3f}", status)

    console.print(table)
    console.print(f"\nGate: {'[green]PASS[/green]' if report.gate_exit == 0 else '[red]FAIL[/red]'}")

    raise typer.Exit(report.gate_exit)


# ── check ────────────────────────────────────────────────────────────


def check(
    api_key: str | None = typer.Option(None, "--api-key", envvar="EVALGATE_API_KEY"),
    base_url: str | None = typer.Option(None, "--base-url", envvar="EVALGATE_BASE_URL"),
    evaluation_id: int | None = typer.Option(None, "--evaluation-id", help="Evaluation to check"),
    min_score: float = typer.Option(0.0, "--min-score", help="Minimum passing score (0-100)"),
    max_drop: float | None = typer.Option(None, "--max-drop", help="Max allowed regression delta"),
    baseline: str = typer.Option("published", "--baseline", help="Baseline mode: published|previous|production|auto"),
    fmt: str = typer.Option("human", "--format", "-f", help="Output format: human|json"),
) -> None:
    """CI/CD gate — check evaluation quality score via the API."""
    from evalgate_sdk.client import AIEvalClient
    from evalgate_sdk.errors import EvalGateError

    EXIT_PASS = 0
    EXIT_SCORE_FAIL = 1
    EXIT_REGRESSION = 2
    EXIT_API_ERROR = 4
    EXIT_BAD_ARGS = 5

    api_key, base_url = _resolve_credentials(api_key, base_url)

    if not evaluation_id:
        console.print("[red]--evaluation-id is required[/red]")
        raise typer.Exit(EXIT_BAD_ARGS)

    if not api_key:
        console.print("[red]--api-key or EVALGATE_API_KEY is required (or run evalgate configure)[/red]")
        raise typer.Exit(EXIT_BAD_ARGS)

    async def _check() -> int:
        client = AIEvalClient(api_key=api_key, base_url=base_url)
        try:
            quality = await client.get_quality(evaluation_id, baseline=baseline)
        except EvalGateError as exc:
            console.print(f"[red]API error:[/red] {exc}")
            return EXIT_API_ERROR
        finally:
            await client.close()

        score = quality.score
        if score is None:
            console.print("[yellow]No quality score available[/yellow]")
            return EXIT_API_ERROR

        if fmt == "json":
            console.print(json.dumps(quality.model_dump(by_alias=True, exclude_none=True), indent=2))
        else:
            table = Table(title="Quality Gate")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", justify="right")

            table.add_row("Score", f"{score:.1f}")
            table.add_row("Min Score", f"{min_score:.1f}")
            if quality.evidence_level:
                table.add_row("Evidence", quality.evidence_level)
            if quality.total is not None:
                table.add_row("Total Tests", str(quality.total))
            if quality.regression_delta is not None:
                table.add_row("Regression Δ", f"{quality.regression_delta:+.1f}")
            if quality.avg_latency_ms is not None:
                table.add_row("Avg Latency", f"{quality.avg_latency_ms:.0f}ms")
            if quality.cost_usd is not None:
                table.add_row("Cost", f"${quality.cost_usd:.4f}")
            if quality.flags:
                table.add_row("Flags", ", ".join(quality.flags))
            console.print(table)

        if (
            max_drop is not None
            and quality.regression_delta is not None
            and quality.regression_delta <= -max_drop
        ):
            console.print(
                f"[red]✗ FAIL — regression {quality.regression_delta:+.1f} "
                f"exceeds max drop {max_drop}[/red]"
            )
            return EXIT_REGRESSION

        if score < min_score:
            console.print(f"[red]✗ FAIL — score {score:.1f} < min {min_score:.1f}[/red]")
            return EXIT_SCORE_FAIL

        console.print("[green]✓ PASS[/green]")
        return EXIT_PASS

    exit_code = _run_async(_check())
    raise typer.Exit(exit_code)


# ── ci ───────────────────────────────────────────────────────────────


def ci(
    eval_dir: str = typer.Option("evals", "--dir", "-d"),
    baseline_path: str = typer.Option(".evalgate/baseline.json", "--baseline", "-b"),
    output: str = typer.Option(".evalgate/last-run.json", "--output", "-o"),
    min_score: float = typer.Option(0.8, "--min-score", help="Minimum passing score"),
    max_drop: float = typer.Option(0.05, "--max-drop", help="Max allowed score drop"),
) -> None:
    """CI loop — run evals then gate against baseline (one command for CI)."""
    console.print("[bold]EvalGate CI Pipeline[/bold]\n")

    console.print("[bold]Step 1/2:[/bold] Running evaluations...")
    try:
        run(eval_dir=eval_dir, spec_ids=None, output=output, verbose=False)
    except SystemExit as e:
        if e.code != 0:
            console.print("[red]Evaluations failed — skipping gate[/red]")
            raise typer.Exit(e.code or 1) from e

    console.print("\n[bold]Step 2/2:[/bold] Running regression gate...")
    gate(baseline_path=baseline_path, report_path=output, min_score=min_score, max_drop=max_drop)


# ── doctor ───────────────────────────────────────────────────────────


def doctor() -> None:
    """Pre-flight check — verify environment and configuration."""
    console.print("[bold]EvalGate Doctor[/bold]\n")
    checks = []

    # Python version
    import platform

    py_ver = platform.python_version()
    py_ok = tuple(int(x) for x in py_ver.split(".")[:2]) >= (3, 9)
    checks.append(("Python >= 3.9", py_ok, py_ver))

    # SDK installed
    checks.append(("evalgate-sdk installed", True, __version__))

    # API key
    saved_cfg = _load_saved_config()
    has_key = bool(os.environ.get("EVALGATE_API_KEY") or saved_cfg.get("api_key"))
    key_source = "env" if os.environ.get("EVALGATE_API_KEY") else ("config" if saved_cfg.get("api_key") else "missing")
    checks.append(("API key configured", has_key, key_source))

    # Config file
    config_exists = Path(".evalgate/config.json").exists()
    checks.append((".evalgate/config.json", config_exists, "found" if config_exists else "missing"))

    # Baseline
    baseline_exists = Path(".evalgate/baseline.json").exists()
    checks.append((".evalgate/baseline.json", baseline_exists, "found" if baseline_exists else "missing"))

    # Eval directory
    evals_exist = Path("evals").exists()
    checks.append(("evals/ directory", evals_exist, "found" if evals_exist else "missing"))

    # Optional deps
    for pkg in ["openai", "anthropic"]:
        try:
            __import__(pkg)
            checks.append((f"{pkg} installed", True, "yes"))
        except ImportError:
            checks.append((f"{pkg} installed", None, "optional"))

    table = Table(title="Environment Check")
    table.add_column("Check", style="cyan")
    table.add_column("Status")
    table.add_column("Details")

    for name, ok, detail in checks:
        if ok is True:
            status = "[green]✓[/green]"
        elif ok is False:
            status = "[red]✗[/red]"
        else:
            status = "[yellow]○[/yellow]"
        table.add_row(name, status, str(detail))

    console.print(table)

    failures = sum(1 for _, ok, _ in checks if ok is False)
    if failures:
        console.print(f"\n[red]{failures} issue(s) found[/red]")
        raise typer.Exit(1)
    console.print("\n[green]All checks passed![/green]")


# ── discover ─────────────────────────────────────────────────────────


def discover(
    eval_dir: str = typer.Option("evals", "--dir", "-d"),
    manifest: bool = typer.Option(False, "--manifest", help="Output JSON manifest"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show load errors"),
) -> None:
    """Discover eval specs in the project."""
    from evalgate_sdk.runtime import create_eval_runtime

    cwd = Path.cwd()
    eval_path = cwd / eval_dir
    handle = create_eval_runtime(str(cwd))

    if not eval_path.exists():
        handle.dispose()
        console.print(f"[yellow]No eval directory at {eval_dir}/[/yellow]")
        raise typer.Exit(0)

    try:
        for spec_file in sorted(eval_path.glob("**/*.py")):
            if spec_file.name.startswith("_"):
                continue
            try:
                import importlib.util

                spec_module = importlib.util.spec_from_file_location(spec_file.stem, spec_file)
                if spec_module and spec_module.loader:
                    mod = importlib.util.module_from_spec(spec_module)
                    spec_module.loader.exec_module(mod)
            except Exception as exc:
                if verbose:
                    console.print(f"[yellow]Warning: failed to load {spec_file.name}:[/yellow] {exc}")

        specs = handle.runtime.list()
    finally:
        handle.dispose()

    if manifest:
        out = {"specs": [{"id": s.id, "name": s.name, "suite": s.suite, "tags": s.options.tags} for s in specs]}
        console.print(json.dumps(out, indent=2))
    else:
        table = Table(title=f"Discovered Specs ({len(specs)})")
        table.add_column("ID", style="dim")
        table.add_column("Name", style="cyan")
        table.add_column("Suite")
        table.add_column("Tags")
        for s in specs:
            table.add_row(s.id[:12], s.name, s.suite or "-", ", ".join(s.options.tags) or "-")
        console.print(table)


# ── diff ─────────────────────────────────────────────────────────────


def diff(
    report_a: str = typer.Argument(..., help="First run report"),
    report_b: str = typer.Argument(..., help="Second run report"),
) -> None:
    """Compare two run reports."""
    pa, pb = Path(report_a), Path(report_b)
    if not pa.exists():
        console.print(f"[red]Report not found:[/red] {report_a}")
        raise typer.Exit(1)
    if not pb.exists():
        console.print(f"[red]Report not found:[/red] {report_b}")
        raise typer.Exit(1)

    a = json.loads(pa.read_text())
    b = json.loads(pb.read_text())

    results_a = {r["spec"]: r for r in a.get("results", [])}
    results_b = {r["spec"]: r for r in b.get("results", [])}

    all_specs = sorted(set(results_a) | set(results_b))

    table = Table(title="Run Comparison")
    table.add_column("Spec", style="cyan")
    table.add_column("Score A", justify="right")
    table.add_column("Score B", justify="right")
    table.add_column("Delta", justify="right")
    table.add_column("Status")

    for spec in all_specs:
        sa = results_a.get(spec, {}).get("score", 0)
        sb = results_b.get(spec, {}).get("score", 0)
        delta = sb - sa
        status = "[green]improved[/green]" if delta > 0 else ("[red]regressed[/red]" if delta < 0 else "unchanged")
        table.add_row(spec, f"{sa:.3f}", f"{sb:.3f}", f"{delta:+.3f}", status)

    console.print(table)


# ── explain ──────────────────────────────────────────────────────────


def explain(
    report_path: str = typer.Argument(".evalgate/last-run.json", help="Run report to explain"),
) -> None:
    """Explain failures in a run report."""
    rp = Path(report_path)
    if not rp.exists():
        console.print(f"[red]Report not found:[/red] {report_path}")
        raise typer.Exit(1)

    report = json.loads(rp.read_text())
    failures = [r for r in report.get("results", []) if not r.get("passed")]

    if not failures:
        console.print("[green]No failures to explain — all specs passed![/green]")
        return

    console.print(f"[bold]{len(failures)} failure(s) found:[/bold]\n")
    for f in failures:
        console.print(f"  [red]✗[/red] [bold]{f['spec']}[/bold]")
        console.print(f"    Score: {f.get('score', 0):.3f}")
        if "error" in f:
            console.print(f"    Error: {f['error']}")
        console.print()


# ── baseline ─────────────────────────────────────────────────────────


def baseline(
    action: str = typer.Argument("init", help="Action: init or update"),
    path: str = typer.Option(".evalgate/baseline.json", "--path", "-p"),
    report_path: str | None = typer.Option(None, "--from-report", help="Update baseline from a run report"),
) -> None:
    """Manage baselines — init or update from a run report."""
    bp = Path(path)

    if action == "init":
        bp.parent.mkdir(parents=True, exist_ok=True)
        if bp.exists():
            console.print(f"[yellow]Baseline already exists at {path}[/yellow]")
            return
        bp.write_text(
            json.dumps(
                {
                    "version": 1,
                    "scores": {},
                    "latencies": {},
                    "tolerance": {"score_drop": 0.05, "latency_increase_pct": 20.0, "min_confidence": 0.8},
                },
                indent=2,
            )
        )
        console.print(f"[green]✓[/green] Created baseline at {path}")

    elif action == "update":
        if not report_path:
            console.print("[red]--from-report required for update[/red]")
            raise typer.Exit(1)
        rp = Path(report_path)
        if not rp.exists():
            console.print(f"[red]Report not found:[/red] {report_path}")
            raise typer.Exit(1)

        report = json.loads(rp.read_text())
        existing = json.loads(bp.read_text()) if bp.exists() else {"version": 1, "scores": {}, "latencies": {}}

        for r in report.get("results", []):
            existing["scores"][r["spec"]] = r["score"]
            if "duration_ms" in r:
                existing.setdefault("latencies", {})[r["spec"]] = r["duration_ms"]

        bp.write_text(json.dumps(existing, indent=2))
        console.print(f"[green]✓[/green] Updated baseline with {len(report.get('results', []))} results")

    else:
        console.print(f"[red]Unknown action:[/red] {action}")
        raise typer.Exit(1)


# ── print-config ──────────────────────────────────────────────────


def print_config(
    path: str = typer.Option(".evalgate/config.json", "--path", "-p"),
) -> None:
    """Print the current project configuration."""
    cp = Path(path)
    if not cp.exists():
        console.print(f"[yellow]No config found at {path}[/yellow]")
        console.print("Run [cyan]evalai init[/cyan] first")
        raise typer.Exit(1)

    config = json.loads(cp.read_text())

    table = Table(title="Project Configuration")
    table.add_column("Key", style="cyan")
    table.add_column("Value")

    for key, value in config.items():
        table.add_row(key, json.dumps(value) if isinstance(value, (dict, list)) else str(value))

    console.print(table)
    console.print(f"\n[dim]Config path: {cp.resolve()}[/dim]")


# ── share ─────────────────────────────────────────────────────────


def share(
    evaluation_id: int = typer.Option(..., "--evaluation-id", help="Evaluation ID"),
    run_id: int = typer.Option(..., "--run-id", help="Evaluation run ID"),
    expires: str = typer.Option("7d", "--expires", help="Expiry e.g. 7d, 24h"),
    api_key: str | None = typer.Option(None, "--api-key", envvar="EVALGATE_API_KEY"),
    base_url: str | None = typer.Option(None, "--base-url", envvar="EVALGATE_BASE_URL"),
) -> None:
    """Create a shareable link for an evaluation run."""
    from evalgate_sdk.client import AIEvalClient
    from evalgate_sdk.errors import EvalGateError

    api_key, base_url = _resolve_credentials(api_key, base_url)

    if not api_key:
        console.print("[red]--api-key or EVALGATE_API_KEY required (or run evalgate configure)[/red]")
        raise typer.Exit(1)

    def _parse_expires(spec: str) -> int | None:
        import re

        m = re.match(r"^(\d+)(d|h|m|s)$", spec, re.IGNORECASE)
        if not m:
            return None
        n = int(m.group(1))
        unit = m.group(2).lower()
        if unit == "d":
            return n
        if unit == "h":
            return max(1, n // 24)
        return 1

    expires_days = _parse_expires(expires)
    if expires_days is None:
        console.print("[red]Invalid --expires format. Use e.g. 7d, 24h[/red]")
        raise typer.Exit(1)

    async def _share() -> int:
        client = AIEvalClient(api_key=api_key, base_url=base_url)
        try:
            console.print("Fetching run export...")
            export_data = await client.get_run_export(evaluation_id, run_id)

            console.print("Publishing share link...")
            result = await client.publish_share(
                evaluation_id,
                export_data,
                run_id,
                expires_in_days=expires_days,
            )

            share_url = result.get("shareUrl", "")
            console.print(f"[green]✓[/green] Share link (expires in {expires}): {share_url}")
            return 0
        except EvalGateError as exc:
            console.print(f"[red]API error:[/red] {exc}")
            return 1
        finally:
            await client.close()

    exit_code = _run_async(_share())
    raise typer.Exit(exit_code)


# ── configure ─────────────────────────────────────────────────────


def configure(
    api_key: str | None = typer.Option(None, "--api-key", help="API key (prompted if not given)"),
    base_url: str = typer.Option(
        "https://evalgate.com",
        "--base-url",
        help="Platform base URL",
    ),
) -> None:
    """Set up API key and validate connection."""
    from evalgate_sdk.client import AIEvalClient
    from evalgate_sdk.errors import EvalGateError

    if not api_key:
        api_key = typer.prompt("Enter your API key", hide_input=True)

    if not api_key:
        console.print("[red]API key is required[/red]")
        raise typer.Exit(1)

    console.print("Validating API key...")

    async def _validate() -> bool:
        client = AIEvalClient(api_key=api_key, base_url=base_url)
        try:
            org = await client.organizations.get_current()
            console.print(f"[green]✓[/green] Connected — org [bold]{org.name}[/bold] (id={org.id})")
            return True
        except EvalGateError as exc:
            console.print(f"[red]✗ Validation failed:[/red] {exc}")
            return False
        finally:
            await client.close()

    if not _run_async(_validate()):
        raise typer.Exit(1)

    config_dir = Path.cwd() / ".evalgate"
    config_dir.mkdir(exist_ok=True)
    config_path = config_dir / "config.json"

    config: dict[str, Any] = {}
    if config_path.exists():
        config = json.loads(config_path.read_text())

    config["api_key"] = api_key
    config["base_url"] = base_url

    config_path.write_text(json.dumps(config, indent=2))
    console.print(f"[green]✓[/green] Saved to {config_path.relative_to(Path.cwd())}")
    console.print("\n[dim]Tip: add .evalgate/ to .gitignore to avoid committing credentials[/dim]")


# ── upgrade ───────────────────────────────────────────────────────


def upgrade() -> None:
    """Check for SDK updates and print upgrade instructions."""
    import httpx

    console.print("[bold]Checking for updates...[/bold]\n")

    try:
        resp = httpx.get("https://pypi.org/pypi/pauly4010-evalgate-sdk/json", timeout=10)
        if resp.status_code == 200:
            latest = resp.json()["info"]["version"]
            if latest == __version__:
                console.print(f"[green]✓ You're on the latest version ({__version__})[/green]")
            else:
                console.print(f"  Current: [yellow]{__version__}[/yellow]")
                console.print(f"  Latest:  [green]{latest}[/green]\n")
                console.print("Upgrade with:")
                console.print(f'  [cyan]pip install "pauly4010-evalgate-sdk=={latest}"[/cyan]')
        else:
            console.print(f"[yellow]Could not check PyPI (HTTP {resp.status_code})[/yellow]")
    except Exception as exc:
        console.print(f"[yellow]Could not reach PyPI:[/yellow] {exc}")


# ── impact-analysis ───────────────────────────────────────────────


def impact_analysis(
    eval_dir: str = typer.Option("evals", "--dir", "-d"),
    baseline_path: str = typer.Option(".evalgate/baseline.json", "--baseline", "-b"),
) -> None:
    """Analyze which eval specs would be affected by code changes."""
    from evalgate_sdk.runtime import create_eval_runtime

    cwd = Path.cwd()
    eval_path = cwd / eval_dir

    if not eval_path.exists():
        console.print(f"[yellow]No eval directory at {eval_dir}/[/yellow]")
        raise typer.Exit(0)

    handle = create_eval_runtime(str(cwd))

    for spec_file in sorted(eval_path.glob("**/*.py")):
        if spec_file.name.startswith("_"):
            continue
        try:
            import importlib.util

            spec_module = importlib.util.spec_from_file_location(spec_file.stem, spec_file)
            if spec_module and spec_module.loader:
                mod = importlib.util.module_from_spec(spec_module)
                spec_module.loader.exec_module(mod)
        except Exception:
            pass

    specs = handle.runtime.list()

    bp = Path(baseline_path)
    baseline_scores: dict[str, float] = {}
    if bp.exists():
        raw = json.loads(bp.read_text())
        baseline_scores = raw.get("scores", {})

    table = Table(title="Impact Analysis")
    table.add_column("Spec", style="cyan")
    table.add_column("Suite")
    table.add_column("Baseline Score", justify="right")
    table.add_column("Has Baseline")
    table.add_column("Risk")

    for s in specs:
        score = baseline_scores.get(s.name)
        has_baseline = score is not None
        risk = "[green]low[/green]"
        if not has_baseline:
            risk = "[yellow]unknown[/yellow]"
        elif score is not None and score < 0.8:
            risk = "[red]high[/red]"

        table.add_row(
            s.name,
            s.suite or "-",
            f"{score:.3f}" if score is not None else "-",
            "[green]yes[/green]" if has_baseline else "[red]no[/red]",
            risk,
        )

    console.print(table)
    console.print(f"\n[dim]{len(specs)} spec(s) discovered, {len(baseline_scores)} with baselines[/dim]")
    handle.dispose()


# ── migrate ───────────────────────────────────────────────────────


def migrate(
    action: str = typer.Argument("config", help="What to migrate: config"),
    path: str = typer.Option(".evalgate/config.json", "--path", "-p"),
) -> None:
    """Migrate config or baseline to the latest format."""
    if action != "config":
        console.print(f"[red]Unknown migration target:[/red] {action}")
        console.print("Supported: [cyan]config[/cyan]")
        raise typer.Exit(1)

    cp = Path(path)
    if not cp.exists():
        console.print(f"[yellow]No config at {path}[/yellow]")
        console.print("Run [cyan]evalai init[/cyan] first")
        raise typer.Exit(1)

    config = json.loads(cp.read_text())
    current_version = config.get("version", 0)

    if current_version >= 1:
        console.print(f"[green]✓ Config already at latest version ({current_version})[/green]")
        return

    config["version"] = 1
    config.setdefault("project_name", Path.cwd().name)
    config.setdefault("eval_dir", "evals")
    config.setdefault("baseline", ".evalgate/baseline.json")

    cp.write_text(json.dumps(config, indent=2))
    console.print(f"[green]✓ Migrated config from v{current_version} to v1[/green]")
