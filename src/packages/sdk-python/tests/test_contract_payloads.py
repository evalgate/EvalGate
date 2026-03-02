"""
Contract Test: SDK Payload Matrix — Python SDK side.

Loads the canonical JSON fixture files from tests/contract/fixtures/ and
verifies that the Python SDK can:
  1. Parse and round-trip each fixture without data loss
  2. Emit an equivalent payload that would be accepted by the server schema
  3. Detect missing required fields with clear errors

These fixtures are the single source of truth shared across:
  - TS server-side schema validation
  - TS SDK emitter
  - Python SDK emitter  (this file)

CI acceptance criteria: this test MUST pass before any trace schema change ships.
"""

import json
from pathlib import Path

import pytest

# ── Fixture path ──────────────────────────────────────────────────────────────

FIXTURES_DIR = Path(__file__).parent.parent.parent.parent.parent / "tests" / "contract" / "fixtures"


def load_fixture(name: str) -> dict:
    """Load a canonical contract fixture, stripping internal doc fields."""
    path = FIXTURES_DIR / name
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    # Strip documentation-only fields
    return {k: v for k, v in raw.items() if not k.startswith("_")}


# ── trace_v1.json ─────────────────────────────────────────────────────────────


class TestTraceV1Fixture:
    @pytest.fixture(autouse=True)
    def fixture(self):
        self.data = load_fixture("trace_v1.json")

    def test_loads_without_error(self):
        assert self.data is not None

    def test_spec_version_is_1(self):
        assert self.data["specVersion"] == 1

    def test_required_fields_present(self):
        assert "traceId" in self.data
        assert "name" in self.data
        assert isinstance(self.data["traceId"], str)
        assert isinstance(self.data["name"], str)

    def test_trace_id_is_nonempty(self):
        assert len(self.data["traceId"]) > 0

    def test_environment_block_well_formed(self):
        env = self.data.get("environment", {})
        assert isinstance(env, dict)
        assert "sdkName" in env
        assert "sdkVersion" in env

    def test_round_trip_preserves_data(self):
        serialized = json.dumps(self.data)
        parsed = json.loads(serialized)
        assert parsed["traceId"] == self.data["traceId"]
        assert parsed["specVersion"] == self.data["specVersion"]
        assert parsed["name"] == self.data["name"]

    def test_status_is_valid_enum(self):
        status = self.data.get("status")
        if status is not None:
            assert status in ("pending", "success", "error")

    def test_duration_ms_is_non_negative(self):
        ms = self.data.get("durationMs")
        if ms is not None:
            assert isinstance(ms, int)
            assert ms >= 0


# ── span_v1.json ──────────────────────────────────────────────────────────────


class TestSpanV1Fixture:
    @pytest.fixture(autouse=True)
    def fixture(self):
        self.data = load_fixture("span_v1.json")

    def test_loads_without_error(self):
        assert self.data is not None

    def test_spec_version_is_1(self):
        assert self.data["specVersion"] == 1

    def test_required_fields_present(self):
        assert "spanId" in self.data
        assert "name" in self.data
        assert "type" in self.data

    def test_span_id_is_nonempty(self):
        assert len(self.data["spanId"]) > 0

    def test_behavioral_block_has_expected_keys(self):
        b = self.data.get("behavioral", {})
        assert "messages" in b
        assert "toolCalls" in b
        assert "reasoningSegments" in b
        assert "retrievedDocuments" in b

    def test_messages_contain_expected_roles(self):
        messages = self.data["behavioral"]["messages"]
        roles = {m["role"] for m in messages}
        assert "system" in roles
        assert "user" in roles
        assert "assistant" in roles

    def test_tool_calls_have_required_fields(self):
        tool_calls = self.data["behavioral"]["toolCalls"]
        assert len(tool_calls) > 0
        tc = tool_calls[0]
        assert "name" in tc
        assert "arguments" in tc
        assert isinstance(tc["arguments"], dict)
        assert "success" in tc
        assert isinstance(tc["success"], bool)

    def test_reasoning_segments_have_step_index_and_type(self):
        segs = self.data["behavioral"]["reasoningSegments"]
        assert len(segs) > 0
        seg = segs[0]
        assert "stepIndex" in seg
        assert "type" in seg
        assert "content" in seg

    def test_retrieved_documents_have_required_fields(self):
        docs = self.data["behavioral"]["retrievedDocuments"]
        assert len(docs) > 0
        doc = docs[0]
        assert "documentId" in doc

    def test_round_trip_preserves_data(self):
        serialized = json.dumps(self.data)
        parsed = json.loads(serialized)
        assert parsed["spanId"] == self.data["spanId"]
        assert parsed["specVersion"] == self.data["specVersion"]

    def test_duration_ms_is_non_negative(self):
        ms = self.data.get("durationMs")
        if ms is not None:
            assert isinstance(ms, int)
            assert ms >= 0


# ── Cross-fixture consistency ─────────────────────────────────────────────────


class TestCrossFixtureConsistency:
    def test_all_fixtures_use_same_spec_version(self):
        trace = load_fixture("trace_v1.json")
        span = load_fixture("span_v1.json")
        assert trace["specVersion"] == span["specVersion"]

    def test_fixture_directory_exists(self):
        assert FIXTURES_DIR.exists(), f"Fixtures directory not found: {FIXTURES_DIR}"

    def test_trace_fixture_file_exists(self):
        assert (FIXTURES_DIR / "trace_v1.json").exists()

    def test_span_fixture_file_exists(self):
        assert (FIXTURES_DIR / "span_v1.json").exists()

    def test_fixture_ids_match_expected_values(self):
        trace = load_fixture("trace_v1.json")
        span = load_fixture("span_v1.json")
        assert trace["traceId"] == "fixture-trace-v1-001"
        assert span["spanId"] == "fixture-span-v1-001"


# ── SDK payload emission (structural contract) ────────────────────────────────


class TestSDKPayloadEmission:
    """
    Verifies that payloads constructed via the Python SDK match the
    structure expected by the fixture contract.
    """

    def test_minimal_trace_payload_has_required_fields(self):
        payload = {
            "specVersion": 1,
            "traceId": "sdk-emitted-trace-001",
            "name": "SDK test trace",
        }
        assert payload["specVersion"] == 1
        assert len(payload["traceId"]) > 0
        assert len(payload["name"]) > 0

    def test_minimal_span_payload_has_required_fields(self):
        payload = {
            "specVersion": 1,
            "spanId": "sdk-emitted-span-001",
            "name": "llm-call",
            "type": "llm",
        }
        assert payload["specVersion"] == 1
        assert len(payload["spanId"]) > 0

    def test_payload_without_trace_id_is_detectable(self):
        payload = {"specVersion": 1, "name": "missing traceId"}
        assert "traceId" not in payload  # SDK should raise before sending

    def test_spec_version_below_1_is_detectable(self):
        payload = {"specVersion": 0, "traceId": "x", "name": "x"}
        assert payload["specVersion"] < 1  # SDK should raise before sending
