"""EvalGate SDK — EvalGate client for Python."""

from evalgate_sdk._version import SDK_VERSION, SPEC_VERSION, __version__
from evalgate_sdk.assertions import (
    AssertionLLMConfig,
    AssertionResult,
    Expectation,
    configure_assertions,
    contains_all_required_fields,
    contains_json,
    contains_keywords,
    contains_language,
    contains_language_async,
    expect,
    follows_instructions,
    get_assertion_config,
    has_consistency,
    has_consistency_async,
    has_factual_accuracy,
    has_factual_accuracy_async,
    has_length,
    has_no_hallucinations,
    has_no_hallucinations_async,
    has_no_toxicity,
    has_no_toxicity_async,
    has_pii,
    has_readability_score,
    has_sentiment,
    has_sentiment_async,
    has_sentiment_with_score,
    has_valid_code_syntax,
    has_valid_code_syntax_async,
    is_valid_email,
    is_valid_url,
    matches_pattern,
    matches_schema,
    not_contains_pii,
    responded_within_duration,
    responded_within_time,
    responded_within_time_since,
    run_assertions,
    similar_to,
    to_semantically_contain,
    within_range,
)
from evalgate_sdk.batch import RequestBatcher, batch_process, can_batch
from evalgate_sdk.cache import CacheTTL, RequestCache, get_ttl, should_cache
from evalgate_sdk.ci_context import CIContext, detect_ci_context
from evalgate_sdk.cli.api import (
    FetchOptions,
    PublishShareResult,
    QualityLatestData,
    RunDetailsData,
    fetch_api,
    fetch_quality_latest,
    fetch_run_details,
    fetch_run_export,
    import_run_on_fail,
    publish_share,
)
from evalgate_sdk.cli.cli_constants import EXIT
from evalgate_sdk.cli.config import (
    EvalAIConfig,
    find_config_path,
    load_config,
    merge_config_with_args,
)
from evalgate_sdk.cli.env import get_github_step_summary_path, is_ci, is_git_ref, is_github_actions
from evalgate_sdk.cli.formatters.types import (
    CHECK_REPORT_SCHEMA_VERSION,
    CheckReport,
    FailedCase,
    GateThresholds,
    ScoreBreakdown01,
    ScoreContribPts,
)
from evalgate_sdk.cli.manifest import (
    EvaluationManifest,
    SpecAnalysis,
    generate_manifest,
    read_lock,
    read_manifest,
    write_manifest,
)
from evalgate_sdk.cli.policy_packs import (
    POLICY_PACKS,
    PolicyPack,
    get_valid_policy_versions,
    resolve_policy_pack,
)
from evalgate_sdk.cli.regression_gate import (
    BuiltinReport,
    run_builtin_gate,
    run_gate,
)
from evalgate_sdk.cli.regression_gate import (
    format_github as format_gate_github,
)
from evalgate_sdk.cli.regression_gate import (
    format_human as format_gate_human,
)
from evalgate_sdk.cli.render.snippet import truncate_snippet
from evalgate_sdk.cli.render.sort import sort_failed_cases
from evalgate_sdk.cli.report.build_check_report import build_check_report, compute_contrib_pts
from evalgate_sdk.cli.traces import (
    RunTrace,
    SpecTrace,
    build_run_trace,
    calculate_percentiles,
    format_latency_table,
    write_traces,
)
from evalgate_sdk.cli.workspace import EvalWorkspace, resolve_eval_workspace
from evalgate_sdk.client import AIEvalClient
from evalgate_sdk.collector import (
    CollectorFeedbackInput,
    CollectorSpanInput,
    ReportTraceInput,
    ReportTraceOptions,
    ReportTraceResult,
    report_trace,
)
from evalgate_sdk.constants import DEFAULT_BASE_URL
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
from evalgate_sdk.formatters import format_github, format_human, format_json, format_pr_comment
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
from evalgate_sdk.local import LocalStorage, LocalStorageStats
from evalgate_sdk.logger import Logger, RequestLogger, create_logger, get_logger, set_logger
from evalgate_sdk.matchers import GateAssertionError, assert_passes_gate, to_pass_gate
from evalgate_sdk.otel import OTelExporter, OTelExporterOptions, OTelExportPayload, create_otel_exporter
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
from evalgate_sdk.pytest_plugin import (
    assert_all_assertions_passed,
    assert_no_errors,
    assert_score_above,
    assert_score_between,
)
from evalgate_sdk.reason_codes import REASON_CODES, get_reason_info, is_blocking
from evalgate_sdk.regression import (
    ARTIFACTS,
    GATE_CATEGORY,
    GATE_EXIT,
    REPORT_SCHEMA_VERSION,
    Baseline,
    BaselineTolerance,
    RegressionDelta,
    RegressionReport,
    compute_baseline_checksum,
    evaluate_regression,
    verify_baseline_checksum,
)
from evalgate_sdk.runtime import (
    EvalExecutionError,
    EvalRuntimeError,
    EvalSDKRuntimeError,
    SpecExecutionError,
    SpecRegistrationError,
)
from evalgate_sdk.runtime.adapters.config_to_dsl import (
    MigrationResult,
    migrate_config_to_dsl,
    migrate_project_to_dsl,
    migrate_testsuite_to_dsl,
)
from evalgate_sdk.runtime.adapters.testsuite_to_dsl import (
    TestDefinition as LegacyTestDefinition,
)
from evalgate_sdk.runtime.adapters.testsuite_to_dsl import (
    TestSuiteAdapterOptions,
    adapt_test_suite,
    generate_define_eval_code,
)
from evalgate_sdk.runtime.context import (
    clone_runtime_context,
    create_runtime_context,
    merge_runtime_contexts,
    validate_runtime_context,
)
from evalgate_sdk.runtime.eval import (
    create_result,
    define_eval,
    define_eval_only,
    define_eval_skip,
    define_suite,
    evalai,
    from_dataset,
    get_filtered_specs,
)
from evalgate_sdk.runtime.execution_mode import (
    ExecutionModeConfig,
    get_execution_mode,
    validate_execution_mode,
)
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
from evalgate_sdk.runtime.run_report import (
    RunReport,
    RunReportBuilder,
    RunResult,
    RunSummary,
    create_run_report,
    parse_run_report,
)
from evalgate_sdk.runtime.types import (
    DependsOn,
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
from evalgate_sdk.utils.input_hash import normalize_input, sha256_input
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
    "AssertionLLMConfig",
    "run_assertions",
    "contains_keywords",
    "matches_pattern",
    "has_length",
    "has_sentiment",
    "has_sentiment_async",
    "has_sentiment_with_score",
    "similar_to",
    "within_range",
    "is_valid_email",
    "is_valid_url",
    "not_contains_pii",
    "has_pii",
    "has_no_hallucinations",
    "has_no_hallucinations_async",
    "matches_schema",
    "contains_json",
    "contains_language",
    "contains_language_async",
    "has_readability_score",
    "has_factual_accuracy",
    "has_factual_accuracy_async",
    "responded_within_time",
    "responded_within_duration",
    "responded_within_time_since",
    "has_no_toxicity",
    "has_no_toxicity_async",
    "has_valid_code_syntax",
    "has_valid_code_syntax_async",
    "has_consistency",
    "has_consistency_async",
    "to_semantically_contain",
    "configure_assertions",
    "get_assertion_config",
    "follows_instructions",
    "contains_all_required_fields",
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
    "CacheTTL",
    "RequestCache",
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
    "compute_baseline_checksum",
    "verify_baseline_checksum",
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
    "define_eval_skip",
    "define_eval_only",
    "define_suite",
    "create_result",
    "evalai",
    "from_dataset",
    "get_filtered_specs",
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
    "DependsOn",
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
    # Collector (T2)
    "report_trace",
    "ReportTraceInput",
    "ReportTraceOptions",
    "ReportTraceResult",
    "CollectorSpanInput",
    "CollectorFeedbackInput",
    # RunReport (T4)
    "RunReport",
    "RunReportBuilder",
    "RunResult",
    "RunSummary",
    "create_run_report",
    "parse_run_report",
    # OTel (T6)
    "OTelExporter",
    "OTelExporterOptions",
    "OTelExportPayload",
    "create_otel_exporter",
    # Local storage (T7)
    "LocalStorage",
    "LocalStorageStats",
    # Execution mode (T8)
    "ExecutionModeConfig",
    "get_execution_mode",
    "validate_execution_mode",
    # Pytest plugin (T9)
    "assert_passes_gate",
    "assert_score_above",
    "assert_score_between",
    "assert_no_errors",
    "assert_all_assertions_passed",
    # CI context (T10)
    "CIContext",
    "detect_ci_context",
    # Reason codes (T10)
    "REASON_CODES",
    "get_reason_info",
    "is_blocking",
    # Formatters (T10)
    "format_human",
    "format_json",
    "format_github",
    "format_pr_comment",
    # Constants (T12)
    "DEFAULT_BASE_URL",
    # Utils (T12)
    "normalize_input",
    "sha256_input",
    # Runtime context (T13)
    "create_runtime_context",
    "merge_runtime_contexts",
    "clone_runtime_context",
    "validate_runtime_context",
    # Runtime adapters (T13)
    "MigrationResult",
    "migrate_config_to_dsl",
    "migrate_project_to_dsl",
    "migrate_testsuite_to_dsl",
    "LegacyTestDefinition",
    "TestSuiteAdapterOptions",
    "adapt_test_suite",
    "generate_define_eval_code",
    # CLI constants (T14)
    "EXIT",
    # CLI env (T14)
    "is_ci",
    "is_github_actions",
    "is_git_ref",
    "get_github_step_summary_path",
    # CLI config (T14)
    "EvalAIConfig",
    "find_config_path",
    "load_config",
    "merge_config_with_args",
    # CLI API (T14)
    "fetch_api",
    "fetch_quality_latest",
    "fetch_run_details",
    "fetch_run_export",
    "import_run_on_fail",
    "publish_share",
    "FetchOptions",
    "QualityLatestData",
    "RunDetailsData",
    "PublishShareResult",
    # CLI formatter types (T15)
    "CHECK_REPORT_SCHEMA_VERSION",
    "CheckReport",
    "FailedCase",
    "GateThresholds",
    "ScoreBreakdown01",
    "ScoreContribPts",
    # CLI manifest (T15)
    "EvaluationManifest",
    "SpecAnalysis",
    "generate_manifest",
    "read_manifest",
    "write_manifest",
    "read_lock",
    # CLI policy packs (T15)
    "POLICY_PACKS",
    "PolicyPack",
    "get_valid_policy_versions",
    "resolve_policy_pack",
    # CLI regression gate (T15)
    "BuiltinReport",
    "run_builtin_gate",
    "run_gate",
    "format_gate_human",
    "format_gate_github",
    # CLI traces (T15)
    "RunTrace",
    "SpecTrace",
    "build_run_trace",
    "calculate_percentiles",
    "format_latency_table",
    "write_traces",
    # CLI render (T15)
    "truncate_snippet",
    "sort_failed_cases",
    # CLI report (T15)
    "build_check_report",
    "compute_contrib_pts",
    # CLI workspace (T15)
    "EvalWorkspace",
    "resolve_eval_workspace",
]
