"""EvalAI CLI — command-line interface for the AI Evaluation Platform."""

from __future__ import annotations


def _ensure_typer() -> None:
    try:
        import typer  # noqa: F401
    except ImportError as exc:
        raise SystemExit("CLI requires typer. Install with: pip install 'evalai-sdk[cli]'") from exc


_ensure_typer()

import typer  # noqa: E402

app = typer.Typer(
    name="evalai",
    help="AI Evaluation Platform CLI — run evals, manage baselines, gate regressions.",
    no_args_is_help=True,
)


from evalai_sdk.cli.commands import (  # noqa: E402
    baseline,
    check,
    ci,
    diff,
    discover,
    doctor,
    explain,
    gate,
    impact_analysis,
    init,
    migrate,
    print_config,
    run,
    share,
    upgrade,
)

app.command("init")(init)
app.command("run")(run)
app.command("gate")(gate)
app.command("check")(check)
app.command("ci")(ci)
app.command("doctor")(doctor)
app.command("discover")(discover)
app.command("diff")(diff)
app.command("explain")(explain)
app.command("baseline")(baseline)
app.command("print-config")(print_config)
app.command("share")(share)
app.command("upgrade")(upgrade)
app.command("impact-analysis")(impact_analysis)
app.command("migrate")(migrate)
