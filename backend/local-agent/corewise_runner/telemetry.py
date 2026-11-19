"""Bounded, read-only psutil and vendor telemetry; unsupported sensors stay null."""

import shutil
import subprocess
from datetime import datetime, timezone

import psutil


def sample():
    memory = psutil.virtual_memory()
    temperature, temperature_source = None, None
    limits = ["Fan speed is not sampled; no clock, voltage or power settings are changed."]
    sensors = getattr(psutil, "sensors_temperatures", None)
    if sensors:
        try:
            readings = sensors()
        except (OSError, NotImplementedError):
            readings = {}
        for name, values in readings.items():
            if name.lower() in {"coretemp", "k10temp", "cpu_thermal"} and values:
                temperature = float(values[0].current)
                temperature_source = "psutil:" + name
                break
    if temperature is None:
        limits.append("CPU temperature is unsupported by this OS/API; not estimated.")
    gpu = None
    utility = shutil.which("nvidia-smi")
    if utility:
        try:
            output = subprocess.run(
                [
                    utility,
                    "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
                    "--format=csv,noheader,nounits",
                    "--id=0",
                ],
                capture_output=True,
                text=True,
                timeout=5,
                check=True,
            ).stdout.strip()
            name, util, used, total, temp, power = [v.strip() for v in output.split(",")]

            def number(value, scale=1):
                try:
                    import math

                    result = float(value) * scale
                    return result if math.isfinite(result) else None
                except ValueError:
                    return None

            gpu = {
                "model": name,
                "utilizationPercent": number(util),
                "memoryUsedBytes": number(used, 2**20),
                "memoryTotalBytes": number(total, 2**20),
                "temperatureC": number(temp),
                "powerWatts": number(power),
                "source": "nvidia-smi",
            }
        except (OSError, ValueError, subprocess.SubprocessError):
            limits.append("NVIDIA telemetry unavailable; GPU fields remain unknown.")
    else:
        limits.append("GPU telemetry unavailable on this device; GPU fields remain unknown.")
    cpu_utilization = psutil.cpu_percent(interval=0.2)
    return {
        "version": "cw-telemetry-1",
        "provenance": "MEASURED",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "cpuUtilizationPercent": cpu_utilization,
        "ramUsedBytes": memory.total - memory.available,
        "ramTotalBytes": memory.total,
        "cpuTemperatureC": temperature,
        "temperatureSource": temperature_source,
        "cpuSource": "psutil",
        "gpu": gpu,
        "limitations": limits,
    }
