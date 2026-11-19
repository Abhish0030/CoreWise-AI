"""Telemetry and collection guard tests; no mock is presented as live hardware evidence."""

from types import SimpleNamespace

import pytest

from corewise_runner.client import monitor
from corewise_runner.collection import PLAN
from corewise_runner.telemetry import sample


def test_monitor_bounds_before_credentials_or_execution():
    for samples, interval in [(121, 1), (0, 1), (1, 0), (120, 10)]:
        with pytest.raises(ValueError):
            monitor(samples, interval)


def test_unsupported_vendor_and_cpu_temperature_are_unknown(monkeypatch):
    monkeypatch.setattr("corewise_runner.telemetry.shutil.which", lambda _: None)
    monkeypatch.setattr("corewise_runner.telemetry.psutil.cpu_percent", lambda interval: 12.5)
    monkeypatch.setattr(
        "corewise_runner.telemetry.psutil.virtual_memory",
        lambda: SimpleNamespace(total=1024, available=512),
    )
    monkeypatch.setattr(
        "corewise_runner.telemetry.psutil.sensors_temperatures", lambda: {}, raising=False
    )
    result = sample()
    assert result["gpu"] is None and result["cpuTemperatureC"] is None
    assert result["ramUsedBytes"] == 512
    assert result["cpuUtilizationPercent"] == 12.5
    assert result["provenance"] == "MEASURED"  # Known controlled unit fixture only.

    def unavailable():
        raise NotImplementedError("No supported temperature API")

    monkeypatch.setattr(
        "corewise_runner.telemetry.psutil.sensors_temperatures", unavailable, raising=False
    )
    assert sample()["cpuTemperatureC"] is None


def test_plan_is_small_and_excludes_calibration_configurations():
    assert len(PLAN) == 5 and all(len(sizes) == 6 for sizes in PLAN.values())
    assert 128 not in PLAN["MATRIX_MULTIPLICATION"]
    assert 200000 not in PLAN["VECTOR_ADDITION"] and 16 not in PLAN["VECTOR_ADDITION"]
    assert max(PLAN["MATRIX_MULTIPLICATION"]) <= 192
    assert max(max(s) for s in PLAN.values()) <= 96000
