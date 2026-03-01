"""EvalGate SDK — EvalGate client for Python."""

from evalgate_sdk._version import SDK_VERSION, SPEC_VERSION, __version__
from evalgate_sdk.assertions import (
    AssertionResult,
    Expectation,
    contains_all_required_fields,
    contains_json,
    contains_keywords,
    contains_language,
    expect,
    follows_instructions,
    has_factual_accuracy,
    has_length,
    has_no_hallucinations,
    has_no_toxicity,
    has_readability_score,
    has_sentiment,
    has_valid_code_syntax,
    is_valid_email,
    is_valid_url,
    matches_pattern,
    matches_schema,
    not_contains_pii,
    responded_within_time,
    run_assertions,
    similar_to,
    within_range,
)
from evalgate_sdk.batch import RequestBatcher, batch_process, can_batch
from evalgate_sdk.cache import CacheTTL, RequestCache, get_ttl, should_cache
from evalgate_sdk.client import AIEvalClient
from evalgate_sdk.context import (
    EvalContext,
    WithContext,
    clone_context,
    create_context,
    get_current_context,
    merge_contexts,
    merge_with_context,
    validate_context,
    with_context,
    with_context_sync,
)
from evalgate_sdk.errors import (
    AuthenticationError,
    EvalGateError,
    NetworkError,
    RateLimitError,
    ValidationError,
    create_error_from_response,
)
from evalgate_sdk.export import (
    ExportData,
    ExportFormat,
    ExportOptions,
    ImportOptions,
    ImportResult,
    convert_to_csv,
    export_data,
    export_to_file,
    import_data,
    import_from_file,
    import_from_langsmith,
)
from evalgate_sdk.integrations.anthropic import trace_anthropic, trace_anthropic_call
from evalgate_sdk.integrations.autogen import trace_autogen
from evalgate_sdk.integrations.crewai import trace_crewai
from evalgate_sdk.integrations.langchain import trace_langchain
from evalgate_sdk.integrations.openai import trace_openai, trace_openai_call
from evalgate_sdk.integrations.openai_eval import (
    OpenAIChatEvalCase,
    OpenAIChatEvalCaseResult,
    OpenAIChatEvalResult,
    openai_chat_eval,
)
from evalgate_sdk.logger import Logger, RequestLogger, create_logger, get_logger, set_logger
from evalgate_sdk.matchers import GateAssertionError, assert_passes_gate, to_pass_gate
from evalgate_sdk.pagination import (
    PaginatedIterator,
    PaginatedResponse,
    auto_paginate,
    create_paginated_iterator,
    create_pagination_meta,
    decode_cursor,
    encode_cursor,
    parse_pagination_params,
)
from evalgate_sdk.regression import (
    ARTIFACTS,
    GATE_CATEGORY,
    GATE_EXIT,
    REPORT_SCHEMA_VERSION,
    Baseline,
    BaselineTolerance,
    RegressionDelta,
    RegressionReport,
    evaluate_regression,
)
from evalgate_sdk.runtime import (
    EvalExecutionError,
    EvalRuntimeError,
    EvalSDKRuntimeError,
    SpecExecutionError,
    SpecRegistrationError,
)
from evalgate_sdk.runtime.eval import create_result, define_eval, define_suite, evalai
from evalgate_sdk.runtime.executor import (
    LocalExecutor,
    create_local_executor,
    default_local_executor,
)
from evalgate_sdk.runtime.registry import (
    create_eval_runtime,
    dispose_active_runtime,
    get_active_runtime,
    set_active_runtime,
    with_runtime,
)
from evalgate_sdk.runtime.types import (
    EvalResult,
    EvalSpec,
    ExecutorCapabilities,
    SpecConfig,
    SpecOptions,
)
from evalgate_sdk.snapshot import (
    SnapshotComparison,
    SnapshotData,
    SnapshotManager,
    SnapshotMetadata,
    compare_with_snapshot,
    delete_snapshot,
    list_snapshots,
    load_snapshot,
    snapshot,
)
from evalgate_sdk.streaming import (
    BatchProgress,
    BatchResult,
    RateLimiter,
    batch_read,
    chunk,
    stream_evaluation,
)
from evalgate_sdk.testing import TestSuite, create_test_suite
from evalgate_sdk.types import CamelModel, QualityBreakdown, QualityScore
from evalgate_sdk.workflows import WorkflowTracer, create_workflow_tracer, trace_workflow_step

__all__ = [
    # Version
    "__version__",
    "SDK_VERSION",
    "SPEC_VERSION",
    # Client
    "AIEvalClient",
    # Errors
    "EvalGateError",
    "RateLimitError",
    "AuthenticationError",
    "NetworkError",
    "ValidationError",
    "create_error_from_response",
    # Assertions
    "expect",
    "Expectation",
    "AssertionResult",
    "run_assertions",
    "contains_keywords",
    "matches_pattern",
    "has_length",
    "has_sentiment",
    "similar_to",
    "within_range",
    "is_valid_email",
    "is_valid_url",
    "not_contains_pii",
    "has_no_hallucinations",
    "matches_schema",
    "contains_json",
    "contains_language",
    "has_readability_score",
    "has_factual_accuracy",
    "responded_within_time",
    "has_no_toxicity",
    "follows_instructions",
    "contains_all_required_fields",
    "has_valid_code_syntax",
    # Testing
    "TestSuite",
    "create_test_suite",
    # Workflows
    "WorkflowTracer",
    "create_workflow_tracer",
    "trace_workflow_step",
    # Context
    "EvalContext",
    "WithContext",
    "create_context",
    "get_current_context",
    "merge_with_context",
    "with_context",
    "with_context_sync",
    "clone_context",
    "merge_contexts",
    "validate_context",
    # Logger
    "Logger",
    "RequestLogger",
    "create_logger",
    "get_logger",
    "set_logger",
    # Pagination
    "PaginatedIterator",
    "PaginatedResponse",
    "auto_paginate",
    "create_paginated_iterator",
    "create_pagination_meta",
    "encode_cursor",
    "decode_cursor",
    "parse_pagination_params",
    # Batch
    "RequestBatcher",
    "batch_process",
    "can_batch",
    # Cache
    "RequestCache",
    "CacheTTL",
    "should_cache",
    "get_ttl",
    # Streaming
    "RateLimiter",
    "BatchProgress",
    "BatchResult",
    "stream_evaluation",
    "batch_read",
    "chunk",
    # Regression
    "GATE_EXIT",
    "GATE_CATEGORY",
    "REPORT_SCHEMA_VERSION",
    "ARTIFACTS",
    "Baseline",
    "BaselineTolerance",
    "RegressionDelta",
    "RegressionReport",
    "evaluate_regression",
    # Snapshot
    "SnapshotManager",
    "SnapshotData",
    "SnapshotMetadata",
    "SnapshotComparison",
    "snapshot",
    "load_snapshot",
    "compare_with_snapshot",
    "delete_snapshot",
    "list_snapshots",
    # Export/Import
    "ExportData",
    "ExportFormat",
    "ExportOptions",
    "ImportOptions",
    "ImportResult",
    "export_data",
    "import_data",
    "export_to_file",
    "import_from_file",
    "import_from_langsmith",
    "convert_to_csv",
    # Matchers
    "to_pass_gate",
    "assert_passes_gate",
    "GateAssertionError",
    # OpenAI integration
    "trace_openai",
    "trace_openai_call",
    "openai_chat_eval",
    "OpenAIChatEvalCase",
    "OpenAIChatEvalCaseResult",
    "OpenAIChatEvalResult",
    # Anthropic integration
    "trace_anthropic",
    "trace_anthropic_call",
    # Framework integrations
    "trace_langchain",
    "trace_crewai",
    "trace_autogen",
    # Runtime DSL
    "define_eval",
    "define_suite",
    "create_result",
    "evalai",
    # Runtime management
    "create_eval_runtime",
    "get_active_runtime",
    "set_active_runtime",
    "dispose_active_runtime",
    "with_runtime",
    # Runtime execution
    "LocalExecutor",
    "create_local_executor",
    "default_local_executor",
    # Runtime types
    "EvalSpec",
    "EvalResult",
    "SpecConfig",
    "SpecOptions",
    "ExecutorCapabilities",
    # Runtime errors
    "EvalRuntimeError",
    "SpecRegistrationError",
    "SpecExecutionError",
    "EvalSDKRuntimeError",
    "EvalExecutionError",
    # Types
    "CamelModel",
    "QualityScore",
    "QualityBreakdown",
]
