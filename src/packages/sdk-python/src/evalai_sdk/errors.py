"""Error classes for the EvalAI SDK, with rich error information and documentation."""

from __future__ import annotations

from datetime import datetime
from typing import Any

_ERROR_DOCS: dict[str, dict[str, Any]] = {
    "MISSING_API_KEY": {
        "documentation": "https://docs.ai-eval-platform.com/errors/missing-api-key",
        "solutions": [
            "Set EVALAI_API_KEY environment variable",
            'Pass api_key in config: AIEvalClient(api_key="...")',
        ],
        "retryable": False,
    },
    "RATE_LIMIT_EXCEEDED": {
        "documentation": "https://docs.ai-eval-platform.com/errors/rate-limit",
        "solutions": [
            "Wait before retrying (check retry_after property)",
            "Upgrade your plan for higher rate limits",
            "Implement exponential backoff",
        ],
        "retryable": True,
    },
    "TIMEOUT": {
        "documentation": "https://docs.ai-eval-platform.com/errors/timeout",
        "solutions": [
            "Increase timeout: AIEvalClient(timeout=60000)",
            "Check your network connection",
        ],
        "retryable": True,
    },
    "NETWORK_ERROR": {
        "documentation": "https://docs.ai-eval-platform.com/errors/network",
        "solutions": [
            "Check your internet connection",
            "Verify the base_url is correct",
        ],
        "retryable": True,
    },
    "UNAUTHORIZED": {
        "documentation": "https://docs.ai-eval-platform.com/errors/unauthorized",
        "solutions": [
            "Verify your API key is correct",
            "Check if your API key has expired",
        ],
        "retryable": False,
    },
    "FORBIDDEN": {
        "documentation": "https://docs.ai-eval-platform.com/errors/forbidden",
        "solutions": [
            "Check if you have permission for this resource",
            "Verify you're using the correct organization ID",
        ],
        "retryable": False,
    },
    "NOT_FOUND": {
        "documentation": "https://docs.ai-eval-platform.com/errors/not-found",
        "solutions": [
            "Verify the resource ID is correct",
            "Check if the resource was deleted",
        ],
        "retryable": False,
    },
    "VALIDATION_ERROR": {
        "documentation": "https://docs.ai-eval-platform.com/errors/validation",
        "solutions": [
            "Check the error details for specific validation failures",
            "Verify all required fields are provided",
        ],
        "retryable": False,
    },
    "INTERNAL_SERVER_ERROR": {
        "documentation": "https://docs.ai-eval-platform.com/errors/server-error",
        "solutions": [
            "Retry the request after a brief delay",
            "Contact support if the issue persists",
        ],
        "retryable": True,
    },
    "FEATURE_LIMIT_REACHED": {
        "documentation": "https://docs.ai-eval-platform.com/errors/feature-limit",
        "solutions": [
            "Upgrade your plan for higher limits",
            "Wait for your usage to reset",
        ],
        "retryable": False,
    },
}

_STATUS_TO_CODE = {
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    408: "TIMEOUT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
}


class EvalAIError(Exception):
    """Base error for the EvalAI SDK with rich diagnostics."""

    code: str
    status_code: int
    documentation: str
    solutions: list[str]
    retryable: bool
    details: Any | None
    retry_after: int | None
    reset_at: datetime | None
    request_id: str | None

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = 0,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details

        doc = _ERROR_DOCS.get(code, {})
        self.documentation = doc.get("documentation", f"https://docs.ai-eval-platform.com/errors/{code}")
        self.solutions = doc.get("solutions", ["Check the error details for more information"])
        self.retryable = doc.get("retryable", False)
        self.retry_after = None
        self.reset_at = None
        self.request_id = None

        if isinstance(details, dict):
            if code == "RATE_LIMIT_EXCEEDED" and "retryAfter" in details:
                self.retry_after = int(details["retryAfter"])
            if code == "FEATURE_LIMIT_REACHED" and "resetAt" in details:
                self.reset_at = datetime.fromisoformat(details["resetAt"])
            self.request_id = details.get("requestId")

    def should_retry(self) -> bool:
        return self.retryable

    def detailed_message(self) -> str:
        lines = [f"{self.code}: {self}", "", f"Documentation: {self.documentation}", ""]
        lines.append("Suggested solutions:")
        for i, s in enumerate(self.solutions, 1):
            lines.append(f"  {i}. {s}")
        if self.retry_after is not None:
            lines.append(f"\nRetry after: {self.retry_after} seconds")
        if self.reset_at is not None:
            lines.append(f"\nLimit resets at: {self.reset_at.isoformat()}")
        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": str(self),
            "status_code": self.status_code,
            "documentation": self.documentation,
            "solutions": self.solutions,
            "retryable": self.retryable,
            "retry_after": self.retry_after,
            "request_id": self.request_id,
            "details": self.details,
        }


class RateLimitError(EvalAIError):
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int | None = None):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", 429, {"retryAfter": retry_after} if retry_after else None)


class AuthenticationError(EvalAIError):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, "UNAUTHORIZED", 401)


class ValidationError(EvalAIError):
    def __init__(self, message: str = "Validation failed", details: Any | None = None):
        super().__init__(message, "VALIDATION_ERROR", 400, details)


class NetworkError(EvalAIError):
    def __init__(self, message: str = "Network request failed"):
        super().__init__(message, "NETWORK_ERROR", 0)
        self.retryable = True


def create_error_from_response(status_code: int, data: Any) -> EvalAIError:
    """Create an EvalAIError from an HTTP response status and body."""
    if isinstance(data, dict):
        error_obj = data.get("error", data)
        if isinstance(error_obj, str):
            error_obj = data
        code = (
            (error_obj.get("code") if isinstance(error_obj, dict) else None)
            or data.get("code")
            or _STATUS_TO_CODE.get(status_code)
            or ("INTERNAL_SERVER_ERROR" if status_code >= 500 else "UNKNOWN_ERROR")
        )
        message = (
            (data["error"] if isinstance(data.get("error"), str) else None)
            or (error_obj.get("message") if isinstance(error_obj, dict) else None)
            or data.get("message")
            or "Unknown error"
        )
        request_id = (error_obj.get("requestId") if isinstance(error_obj, dict) else None) or data.get("requestId")
    else:
        code = _STATUS_TO_CODE.get(status_code, "INTERNAL_SERVER_ERROR" if status_code >= 500 else "UNKNOWN_ERROR")
        message = str(data) if data else "Unknown error"
        request_id = None

    err = EvalAIError(message, code, status_code, data)
    if request_id:
        err.request_id = request_id
    return err
