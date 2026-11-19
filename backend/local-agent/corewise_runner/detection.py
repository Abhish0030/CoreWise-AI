import importlib.metadata
import json
import platform
import shutil
import subprocess
import sys

import psutil


def _windows_adapters():
    """Read adapter identity only; telemetry still requires a provider."""
    if sys.platform != "win32":
        return []
    command = (
        "Get-CimInstance Win32_VideoController | "
        "Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress"
    )
    try:
        output = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        ).stdout.strip()
        if not output:
            return []
        rows = json.loads(output)
        if isinstance(rows, dict):
            rows = [rows]
        return [
            {
                "model": str(row.get("Name") or "Unknown adapter"),
                "memoryBytes": int(row["AdapterRAM"]),
                "driverVersion": str(row.get("DriverVersion") or "unknown"),
                "source": "Windows WMI adapter inventory",
            }
            for row in rows
            if row.get("AdapterRAM")
        ]
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return []


def gpu_runtime():
    try:
        import cupy as cp

        if cp.cuda.runtime.getDeviceCount() < 1:
            return None, "No CUDA device"
        cp.cuda.Device(0).use()
        cp.zeros(1).sum().get()  # Probe real allocation, runtime and kernel compilation.
        return cp, None
    except Exception as exc:
        return None, f"CUDA/CuPy unavailable: {type(exc).__name__}: {str(exc)[:300]}"


def detect(probe_gpu=True):
    cpu = platform.processor() or None
    manufacturer = None
    if sys.platform == "win32":
        try:
            import winreg

            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
            ) as key:
                cpu = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
                manufacturer = winreg.QueryValueEx(key, "VendorIdentifier")[0].strip()
        except OSError:
            pass
    elif sys.platform.startswith("linux"):
        try:
            from pathlib import Path

            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.startswith("model name"):
                    cpu = line.split(":", 1)[1].strip()
                    break
        except OSError:
            pass
    gpus = _windows_adapters()
    utility = shutil.which("nvidia-smi")
    if utility:
        try:
            output = subprocess.run(
                [
                    utility,
                    "--query-gpu=name,memory.total,driver_version",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
                check=True,
            ).stdout
            for line in output.strip().splitlines():
                name, mib, driver = [v.strip() for v in line.split(",")]
                gpus = [gpu for gpu in gpus if gpu["source"] != "Windows WMI adapter inventory"]
                gpus.append(
                    {
                        "model": name,
                        "memoryBytes": int(mib) * 2**20,
                        "driverVersion": driver,
                        "source": "nvidia-smi",
                    }
                )
        except (ValueError, OSError, subprocess.SubprocessError):
            pass
    cp, reason = gpu_runtime() if probe_gpu else (None, "GPU probe disabled")
    runtime = None
    if cp is not None:
        properties = cp.cuda.runtime.getDeviceProperties(0)
        runtime = {
            "backend": "CuPy",
            "version": cp.__version__,
            "runtimeVersion": str(cp.cuda.runtime.runtimeGetVersion()),
            "driverVersion": str(cp.cuda.runtime.driverGetVersion()),
            "model": properties["name"].decode()
            if isinstance(properties["name"], bytes)
            else properties["name"],
            "memoryBytes": int(properties["totalGlobalMem"]),
        }
    versions = {}
    for name in ["numpy", "psutil", "threadpoolctl", "cupy-cuda13x"]:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            pass
    return {
        "source": "DETECTED",
        "cpuModel": cpu,
        "hostname": platform.node(),
        "cpuManufacturer": manufacturer,
        "logicalCpus": psutil.cpu_count(),
        "physicalCores": psutil.cpu_count(logical=False),
        "availableRamBytes": psutil.virtual_memory().available,
        "totalRamBytes": psutil.virtual_memory().total,
        "os": platform.platform(),
        "python": platform.python_version(),
        "libraries": versions,
        "gpus": gpus,
        "gpuRuntime": runtime,
        "gpuUnavailableReason": reason,
    }
