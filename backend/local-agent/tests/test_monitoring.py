"""Controlled transport fixtures; these tests are not live telemetry evidence."""

import json

import httpx
import pytest

from corewise_runner import client
from corewise_runner.lock import execution_lock


class Stop:
    def __init__(self):
        self.stopped = False
        self.delays = []

    def is_set(self):
        return self.stopped

    def set(self):
        self.stopped = True

    def wait(self, delay):
        self.delays.append(delay)


@pytest.fixture
def transport(monkeypatch, tmp_path):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    path = client.metadata_path()
    path.write_text(json.dumps({"origin": "http://127.0.0.1:4000", "agentId": "fixture"}))
    monkeypatch.setattr(client, "secure_keyring", lambda: None)
    monkeypatch.setattr(client.keyring, "get_password", lambda *args: "fixture-token")
    samples = []

    def sample():
        value = {"fixture_sequence": len(samples)}
        samples.append(value)
        return value

    monkeypatch.setattr("corewise_runner.telemetry.sample", sample)
    return samples


def test_continuous_retries_without_queue_and_closes(monkeypatch, transport):
    stop = Stop()
    received = []

    class Backend:
        closed = False

        def __init__(self, origin):
            self.origin = origin

        def request(self, path, data, token=None):
            if path.endswith("session"):
                return {}
            received.append(data)
            if len(received) == 1:
                raise httpx.ConnectError("Controlled disconnected fixture")
            if len(received) == 2:
                raise client.BackendError(429, 8)
            stop.set()

        def close(self):
            Backend.closed = True

    monkeypatch.setattr(client, "Backend", Backend)
    result = client.monitor(continuous=True, stop=stop)
    assert result["status"] == "STOPPED" and result["samples"] == 1
    assert stop.delays == [2, 8, 2]
    assert [s["fixture_sequence"] for s in received] == [0, 1, 2]
    assert Backend.closed


def test_session_refresh_revocation_and_bounded_mode(monkeypatch, transport):
    calls = []

    class Backend:
        def __init__(self, origin):
            self.origin = origin

        def request(self, path, data, token=None):
            calls.append(path)
            if len(calls) in [2, 3]:
                raise client.BackendError(401)

        def close(self):
            pass

    monkeypatch.setattr(client, "Backend", Backend)
    with pytest.raises(client.BackendError):
        client.monitor(continuous=True, stop=Stop())
    assert calls == ["/api/agent/session", "/api/agent/telemetry", "/api/agent/session"]
    calls.clear()
    with pytest.raises(client.BackendError):
        client.monitor(samples=1)
    assert len(calls) == 2


def test_duplicate_monitor_lock_and_legacy_device_registry(monkeypatch, transport, tmp_path):
    with execution_lock("telemetry-fixture"):
        with pytest.raises(ValueError, match="already running"):
            with execution_lock("telemetry-fixture"):
                pass
    assert client.load_device()["agentId"] == "fixture"
    path = client.metadata_path()
    path.write_text(
        json.dumps(
            {
                "origin": "http://127.0.0.1:4000",
                "agentId": "second",
                "devices": [
                    {"origin": "http://127.0.0.1:4000", "agentId": "fixture"},
                    {"origin": "http://127.0.0.1:4000", "agentId": "second"},
                ],
            }
        )
    )
    assert client.load_device()["agentId"] == "second"
    assert client.load_device("fixture")["agentId"] == "fixture"
    with pytest.raises(ValueError, match="not paired"):
        client.load_device("unknown")


def test_bounded_monitor_stops_at_requested_samples(monkeypatch, transport):
    class Backend:
        def __init__(self, origin):
            self.origin = origin

        def request(self, path, data, token=None):
            pass

        def close(self):
            pass

    monkeypatch.setattr(client, "Backend", Backend)
    result = client.monitor(samples=2, stop=Stop())
    assert result["status"] == "COMPLETED" and len(transport) == 2


def test_continuous_ignores_sample_count_and_stops_cleanly(monkeypatch, transport):
    stop = Stop()

    class Backend:
        def __init__(self, origin):
            self.origin = origin

        def request(self, path, data, token=None):
            if path.endswith("telemetry") and len(transport) >= 3:
                stop.set()

        def close(self):
            pass

    monkeypatch.setattr(client, "Backend", Backend)
    result = client.monitor(samples=1, continuous=True, stop=stop)
    assert result["status"] == "STOPPED" and result["samples"] == 3


def test_pair_preserves_old_device_and_requests_owned_profile(monkeypatch, transport):
    class Backend:
        def __init__(self, origin):
            self.origin = origin

        def request(self, path, data):
            assert data["registerHardware"] is True
            return {"agentId": "second", "token": "test-token"}

        def close(self):
            pass

    monkeypatch.setattr(client, "Backend", Backend)
    monkeypatch.setattr(client, "detect", lambda: {"controlled": True})
    monkeypatch.setattr(client.keyring, "set_password", lambda *args: None)
    assert client.pair("http://127.0.0.1:4000", "fixture-code", "Fixture") == "second"
    assert client.load_device("fixture")["agentId"] == "fixture"
    assert "test-token" not in client.metadata_path().read_text()


def test_nvidia_power_unsupported_is_null(monkeypatch):
    from types import SimpleNamespace

    from corewise_runner.telemetry import sample

    monkeypatch.setattr("corewise_runner.telemetry.shutil.which", lambda _: "nvidia-smi")
    monkeypatch.setattr(
        "corewise_runner.telemetry.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(stdout="Fixture GPU, 0, 1, 4096, 50, [N/A]"),
    )
    assert sample()["gpu"]["powerWatts"] is None
