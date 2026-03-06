"""EvalGate CLI — command-line interface for the EvalGate.

This module lazily initializes the CLI app only when typer is available.
Submodules like config.py, api.py, etc. can be imported without typer.
"""

from __future__ import annotations

# Lazy initialization - only set up CLI when typer is available
app = None  # Will be initialized on first access via get_app()


def _ensure_typer() -> None:
    """Check that typer is installed, raise helpful error if not."""
    try:
        import typer  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "CLI requires typer. Install with: pip install 'pauly4010-evalgate-sdk[cli]'"
        ) from exc


def get_app():
    """Get the CLI app, initializing it if needed."""
    global app
    if app is not None:
        return app

    _ensure_typer()

    import typer

    app = typer.Typer(
        name="evalai",
        help="EvalGate CLI — run evals, manage baselines, gate regressions.",
        no_args_is_help=True,
    )

    from evalgate_sdk.cli.commands import (
        baseline,
        check,
        ci,
        configure,
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
    app.command("configure")(configure)
    app.command("upgrade")(upgrade)
    app.command("impact-analysis")(impact_analysis)
    app.command("migrate")(migrate)

    from evalgate_sdk.cli.new_commands import (
        compare,
        promote,
        replay,
        start,
        validate,
        watch,
    )

    app.command("start")(start)
    app.command("watch")(watch)
    app.command("compare")(compare)
    app.command("validate")(validate)
    app.command("promote")(promote)
    app.command("replay")(replay)

    return app


def __getattr__(name: str):
    """Lazy attribute access for 'app'."""
    if name == "app":
        return get_app()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def main() -> None:
    """CLI entry point."""
    cli_app = get_app()
    cli_app()
