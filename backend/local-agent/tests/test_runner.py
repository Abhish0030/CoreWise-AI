from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

from corewise_runner.benchmarks import aggregate, correct, measure
from corewise_runner.client import secure_keyring, validate_origin
from corewise_runner.detection import gpu_runtime
from corewise_runner.schema import Config
from corewise_runner.supervisor import execute


@pytest.mark.parametrize(
    "workload,size",
    [
        ("VECTOR_ADDITION", 4096),
        ("MATRIX_MULTIPLICATION", 32),
        ("SORTING", 4096),
        ("REDUCTION", 4096),
        ("IMAGE_PROCESSING", 4096),
    ],
)
@pytest.mark.parametrize("dtype", ["float32", "float64"])
def test_real_cpu_correctness_and_samples(workload, size, dtype):
    m = measure(Config(workload=workload, size=size, dtype=dtype, gpu=False).model_dump())
    assert m["valid"] and m["cpu"]["correctness"]["valid"]
    assert len(m["cpu"]["samplesMs"]) == 5
    assert m["gpu"] is None and m["speedup"] is None
    assert m["environment"]["source"] == "DETECTED"
    assert m["provenance"] == "MEASURED"


@pytest.mark.parametrize(
    "workload,size",
    [
        ("VECTOR_ADDITION", 4096),
        ("MATRIX_MULTIPLICATION", 32),
        ("SORTING", 4096),
        ("REDUCTION", 4096),
        ("IMAGE_PROCESSING", 4096),
    ],
)
def test_real_gpu_when_available(workload, size):
    cp, reason = gpu_runtime()
    if cp is None:
        pytest.skip(reason)
    m = measure(Config(workload=workload, size=size).model_dump())
    assert m["gpu"] is not None, m["gpuUnavailableReason"]
    assert m["gpu"]["correctness"]["valid"]
    assert m["speedup"] > 0
    for component in ["computeMs", "h2dMs", "d2hMs", "endToEndMs"]:
        assert len(m["gpu"][component]) == 5
        assert all(v > 0 for v in m["gpu"][component])


def test_aggregation_and_invalid_samples():
    s = aggregate([1, 2, 3])
    assert s == {"medianMs": 2, "meanMs": 2, "stddevMs": 1, "minMs": 1, "maxMs": 3}
    for values in [[1], [1, 0, 2], [float("nan"), 1, 2], [float("inf"), 1, 2]]:
        with pytest.raises(ValueError):
            aggregate(values)


def test_correctness_failure_is_visible():
    c = Config(workload="VECTOR_ADDITION", size=16)
    assert not correct(c, np.zeros(16), np.ones(16))["valid"]
    failed = correct(c, np.full(16, np.nan), np.ones(16))
    assert not failed["valid"] and failed["maxAbsoluteError"] is None


def test_os_execution_lock():
    from corewise_runner.lock import execution_lock

    with execution_lock():
        with pytest.raises(ValueError, match="already running"):
            with execution_lock():
                pass


def test_native_credential_vault_roundtrip():
    import secrets

    import keyring

    try:
        secure_keyring()
    except ValueError as exc:
        pytest.skip(str(exc))
    account = secrets.token_hex(16)
    value = secrets.token_urlsafe(48)
    try:
        keyring.set_password("CoreWiseAI Runner Test", account, value)
        assert keyring.get_password("CoreWiseAI Runner Test", account) == value
    finally:
        keyring.delete_password("CoreWiseAI Runner Test", account)


def test_limits_allowlist_and_memory_budget(monkeypatch):
    for config in [
        dict(workload="SHELL", size=16),
        dict(workload="MATRIX_MULTIPLICATION", size=1025),
        dict(workload="SORTING", size=1_000_001),
        dict(workload="VECTOR_ADDITION", size=16, command="echo unsafe"),
    ]:
        with pytest.raises(ValidationError):
            Config.model_validate(config)
    monkeypatch.setattr(
        "corewise_runner.benchmarks.psutil.virtual_memory", lambda: SimpleNamespace(available=1024)
    )
    with pytest.raises(ValueError, match="memory budget"):
        measure(Config(workload="VECTOR_ADDITION", size=4096, gpu=False).model_dump())


def test_missing_gpu_preserves_cpu_measurement(monkeypatch):
    monkeypatch.setattr(
        "corewise_runner.benchmarks.gpu_runtime", lambda: (None, "Test unavailable")
    )
    m = measure(Config(workload="SORTING", size=64, gpu=True).model_dump())
    assert m["cpu"]["correctness"]["valid"] and m["gpu"] is None
    assert m["speedup"] is None and m["gpuUnavailableReason"] == "Test unavailable"


def test_supervisor_timeout_and_cancellation(monkeypatch):
    c = Config(workload="VECTOR_ADDITION", size=4096, gpu=False).model_dump()
    assert execute(c, cancelled=lambda: True)["status"] == "CANCELLED"
    ticks = iter([0, 200])
    monkeypatch.setattr("corewise_runner.supervisor.time.monotonic", lambda: next(ticks))
    assert "timeout" in execute(c)["error"]


def test_transport_and_credential_storage(monkeypatch):
    assert validate_origin("http://127.0.0.1:4000/") == "http://127.0.0.1:4000"
    assert validate_origin("https://example.invalid") == "https://example.invalid"
    for url in [
        "http://example.invalid",
        "https://user:pass@example.invalid",
        "file:///bad",
        "https://example.invalid/path",
        "https://example.invalid?token=x",
    ]:
        with pytest.raises(ValueError):
            validate_origin(url)
    monkeypatch.setattr("corewise_runner.client.keyring.get_keyring", lambda: object())
    with pytest.raises(ValueError, match="vault"):
        secure_keyring()
