"""Tests for local storage / offline mode (T7)."""

from __future__ import annotations

import json

import pytest

from evalgate_sdk.local import LocalStorage, LocalStorageStats


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(str(tmp_path / "evalgate-data"))


class TestLocalStorage:
    def test_save_and_get_trace(self, storage: LocalStorage) -> None:
        storage.save_trace("t-1", {"name": "chat", "spans": []})
        trace = storage.get_trace("t-1")
        assert trace is not None
        assert trace["name"] == "chat"
        assert "saved_at" in trace

    def test_get_nonexistent_trace(self, storage: LocalStorage) -> None:
        assert storage.get_trace("missing") is None

    def test_list_traces(self, storage: LocalStorage) -> None:
        storage.save_trace("t-1", {"name": "a"})
        storage.save_trace("t-2", {"name": "b"})
        ids = storage.list_traces()
        assert ids == ["t-1", "t-2"]

    def test_save_and_get_evaluation(self, storage: LocalStorage) -> None:
        storage.save_evaluation("e-1", {"score": 95.0})
        ev = storage.get_evaluation("e-1")
        assert ev is not None
        assert ev["score"] == 95.0

    def test_list_evaluations(self, storage: LocalStorage) -> None:
        storage.save_evaluation("e-1", {"x": 1})
        storage.save_evaluation("e-2", {"x": 2})
        assert storage.list_evaluations() == ["e-1", "e-2"]

    def test_save_and_get_spans(self, storage: LocalStorage) -> None:
        spans = [{"span_id": "s-1", "name": "llm"}, {"span_id": "s-2", "name": "tool"}]
        storage.save_spans("t-1", spans)
        result = storage.get_spans("t-1")
        assert len(result) == 2
        assert result[0]["span_id"] == "s-1"

    def test_get_spans_missing(self, storage: LocalStorage) -> None:
        assert storage.get_spans("missing") == []

    def test_clear(self, storage: LocalStorage) -> None:
        storage.save_trace("t-1", {"a": 1})
        storage.save_evaluation("e-1", {"b": 2})
        storage.clear()
        assert storage.list_traces() == []
        assert storage.list_evaluations() == []

    def test_get_stats(self, storage: LocalStorage) -> None:
        storage.save_trace("t-1", {"a": 1})
        storage.save_trace("t-2", {"b": 2})
        storage.save_evaluation("e-1", {"c": 3})
        stats = storage.get_stats()
        assert isinstance(stats, LocalStorageStats)
        assert stats.traces == 2
        assert stats.evaluations == 1
        assert stats.total_size_bytes > 0

    def test_export_json(self, storage: LocalStorage, tmp_path) -> None:
        storage.save_trace("t-1", {"name": "chat"})
        storage.save_evaluation("e-1", {"score": 100})
        storage.save_spans("t-1", [{"span_id": "s-1"}])

        export_path = str(tmp_path / "export.json")
        storage.export_json(export_path)

        with open(export_path) as f:
            data = json.load(f)
        assert "t-1" in data["traces"]
        assert "e-1" in data["evaluations"]
        assert "t-1" in data["spans"]
        assert "exported_at" in data
