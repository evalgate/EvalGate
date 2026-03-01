"""Tests for AIEvalClient — uses respx to mock HTTP requests."""

import httpx
import pytest
import respx

from evalgate_sdk.client import AIEvalClient
from evalgate_sdk.errors import EvalGateError
from evalgate_sdk.types import CreateTraceParams


@pytest.fixture
def client():
    return AIEvalClient(api_key="test-key", base_url="https://api.test.com", organization_id=1)


class TestClientInit:
    def test_explicit_config(self, client: AIEvalClient):
        assert client._api_key == "test-key"
        assert client._base_url == "https://api.test.com"
        assert client.organization_id == 1

    def test_init_factory(self, monkeypatch):
        monkeypatch.setenv("EVALGATE_API_KEY", "env-key")
        monkeypatch.setenv("EVALGATE_BASE_URL", "https://env.test.com")
        monkeypatch.setenv("EVALGATE_ORGANIZATION_ID", "42")
        c = AIEvalClient.init()
        assert c._api_key == "env-key"
        assert c._base_url == "https://env.test.com"
        assert c.organization_id == 42

    def test_default_base_url(self):
        c = AIEvalClient(api_key="k")
        assert c._base_url == "http://localhost:3000"


class TestTraceAPI:
    @respx.mock
    @pytest.mark.asyncio
    async def test_create_trace(self, client: AIEvalClient):
        respx.post("https://api.test.com/api/traces").mock(
            return_value=httpx.Response(200, json={"id": 1, "trace_id": "t-1", "name": "test"})
        )
        trace = await client.traces.create(CreateTraceParams(name="test"))
        assert trace.id == 1
        assert trace.name == "test"

    @respx.mock
    @pytest.mark.asyncio
    async def test_list_traces(self, client: AIEvalClient):
        respx.get("https://api.test.com/api/traces").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {"id": 1, "trace_id": "t-1"},
                    {"id": 2, "trace_id": "t-2"},
                ],
            )
        )
        traces = await client.traces.list()
        assert len(traces) == 2

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_trace(self, client: AIEvalClient):
        respx.get("https://api.test.com/api/traces/1").mock(
            return_value=httpx.Response(200, json={"id": 1, "trace_id": "t-1"})
        )
        trace = await client.traces.get(1)
        assert trace.id == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_delete_trace(self, client: AIEvalClient):
        respx.delete("https://api.test.com/api/traces/1").mock(
            return_value=httpx.Response(200, json={"message": "deleted"})
        )
        result = await client.traces.delete(1)
        assert result["message"] == "deleted"


class TestEvaluationAPI:
    @respx.mock
    @pytest.mark.asyncio
    async def test_create_evaluation(self, client: AIEvalClient):
        from evalgate_sdk.types import CreateEvaluationParams

        respx.post("https://api.test.com/api/evaluations").mock(
            return_value=httpx.Response(200, json={"id": 1, "name": "eval-1"})
        )
        ev = await client.evaluations.create(CreateEvaluationParams(name="eval-1"))
        assert ev.id == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_list_evaluations(self, client: AIEvalClient):
        respx.get("https://api.test.com/api/evaluations").mock(
            return_value=httpx.Response(200, json=[{"id": 1, "name": "e1"}])
        )
        evals = await client.evaluations.list()
        assert len(evals) == 1


class TestErrorHandling:
    @respx.mock
    @pytest.mark.asyncio
    async def test_401_raises_error(self, client: AIEvalClient):
        respx.get("https://api.test.com/api/traces/999").mock(
            return_value=httpx.Response(401, json={"message": "Unauthorized"})
        )
        with pytest.raises(EvalGateError) as exc_info:
            await client.traces.get(999)
        assert exc_info.value.status_code == 401

    @respx.mock
    @pytest.mark.asyncio
    async def test_404_raises_error(self, client: AIEvalClient):
        respx.get("https://api.test.com/api/traces/999").mock(
            return_value=httpx.Response(404, json={"message": "Not found"})
        )
        with pytest.raises(EvalGateError) as exc_info:
            await client.traces.get(999)
        assert exc_info.value.code == "NOT_FOUND"

    @respx.mock
    @pytest.mark.asyncio
    async def test_204_returns_empty(self, client: AIEvalClient):
        respx.delete("https://api.test.com/api/traces/1").mock(return_value=httpx.Response(204))
        result = await client.traces.delete(1)
        assert result == {}


class TestContextManager:
    @pytest.mark.asyncio
    async def test_async_context_manager(self):
        async with AIEvalClient(api_key="k") as client:
            assert client._api_key == "k"
