"""Tests for error classes."""

from evalgate_sdk.errors import (
    AuthenticationError,
    EvalGateError,
    NetworkError,
    RateLimitError,
    ValidationError,
    create_error_from_response,
)


class TestEvalGateError:
    def test_basic_error(self):
        err = EvalGateError("something broke", "INTERNAL_SERVER_ERROR", 500)
        assert str(err) == "something broke"
        assert err.code == "INTERNAL_SERVER_ERROR"
        assert err.status_code == 500
        assert err.retryable is True

    def test_documentation_link(self):
        err = EvalGateError("auth", "UNAUTHORIZED", 401)
        assert "unauthorized" in err.documentation

    def test_detailed_message(self):
        err = EvalGateError("oops", "NOT_FOUND", 404)
        msg = err.detailed_message()
        assert "NOT_FOUND" in msg
        assert "Suggested solutions" in msg

    def test_to_dict(self):
        err = EvalGateError("test", "TIMEOUT", 408)
        d = err.to_dict()
        assert d["code"] == "TIMEOUT"
        assert d["retryable"] is True

    def test_rate_limit_retry_after(self):
        err = EvalGateError("slow down", "RATE_LIMIT_EXCEEDED", 429, {"retryAfter": 30})
        assert err.retry_after == 30


class TestSpecificErrors:
    def test_rate_limit(self):
        err = RateLimitError("too fast", retry_after=10)
        assert err.code == "RATE_LIMIT_EXCEEDED"
        assert err.status_code == 429

    def test_auth_error(self):
        err = AuthenticationError()
        assert err.code == "UNAUTHORIZED"
        assert err.status_code == 401

    def test_validation_error(self):
        err = ValidationError("bad input", details={"field": "name"})
        assert err.code == "VALIDATION_ERROR"
        assert err.status_code == 400

    def test_network_error(self):
        err = NetworkError()
        assert err.retryable is True
        assert err.status_code == 0


class TestCreateErrorFromResponse:
    def test_401(self):
        err = create_error_from_response(401, {"message": "Invalid key"})
        assert err.code == "UNAUTHORIZED"
        assert "Invalid key" in str(err)

    def test_429_with_code(self):
        err = create_error_from_response(429, {"code": "RATE_LIMIT_EXCEEDED", "message": "slow"})
        assert err.code == "RATE_LIMIT_EXCEEDED"

    def test_500_unknown(self):
        err = create_error_from_response(500, {"message": "Server error"})
        assert err.code == "INTERNAL_SERVER_ERROR"

    def test_500_none_body(self):
        err = create_error_from_response(500, None)
        assert err.code == "INTERNAL_SERVER_ERROR"

    def test_nested_error(self):
        err = create_error_from_response(
            400, {"error": {"code": "VALIDATION_ERROR", "message": "bad field", "requestId": "req-1"}}
        )
        assert err.code == "VALIDATION_ERROR"
        assert err.request_id == "req-1"
