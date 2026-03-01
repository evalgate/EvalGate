"""Runtime foundation — defineEval DSL, registry, executor."""

from evalgate_sdk.runtime.eval import create_result, define_eval, define_suite
from evalgate_sdk.runtime.executor import create_local_executor, default_local_executor
from evalgate_sdk.runtime.registry import (
    create_eval_runtime,
    dispose_active_runtime,
    get_active_runtime,
    set_active_runtime,
    with_runtime,
)
from evalgate_sdk.runtime.types import (
    EvalContext,
    EvalExecutionError,
    EvalResult,
    EvalRuntimeError,
    EvalSpec,
    ExecutorCapabilities,
    SpecConfig,
    SpecExecutionError,
    SpecOptions,
    SpecRegistrationError,
)
from evalgate_sdk.runtime.types import (
    RuntimeError as EvalSDKRuntimeError,
)

__all__ = [
    "define_eval",
    "define_suite",
    "create_result",
    "create_local_executor",
    "default_local_executor",
    "create_eval_runtime",
    "get_active_runtime",
    "set_active_runtime",
    "dispose_active_runtime",
    "with_runtime",
    "EvalSpec",
    "EvalContext",
    "EvalResult",
    "SpecConfig",
    "SpecOptions",
    "ExecutorCapabilities",
    "EvalRuntimeError",
    "SpecRegistrationError",
    "SpecExecutionError",
    "EvalSDKRuntimeError",
    "EvalExecutionError",
]
