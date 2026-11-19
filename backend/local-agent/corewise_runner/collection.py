"""Fixed bounded collection plan and independent empirical capability calibration.

Calibration samples are excluded from regression labels. Throughputs are effective logical-traffic
observations, not vendor peak specifications. Unattributed host overhead is a conservative launch
cost proxy and explicitly includes allocation/dispatch/synchronization.
"""

import json
import statistics
from pathlib import Path

from .detection import detect
from .supervisor import execute

PLAN = {
    "VECTOR_ADDITION": [16000, 24000, 32000, 48000, 64000, 96000],
    "MATRIX_MULTIPLICATION": [32, 48, 64, 96, 160, 192],
    "SORTING": [4000, 8000, 12000, 16000, 24000, 32000],
    "REDUCTION": [16000, 24000, 32000, 48000, 64000, 96000],
    "IMAGE_PROCESSING": [16000, 24000, 32000, 48000, 64000, 96000],
}


def calibration(dtype):
    raw = []
    for family, size in [
        ("MATRIX_MULTIPLICATION", 128),
        ("VECTOR_ADDITION", 200000),
        ("VECTOR_ADDITION", 16),
    ]:
        result = execute(
            {
                "workload": family,
                "size": size,
                "dtype": dtype,
                "threads": 1,
                "warmups": 2,
                "repetitions": 5,
                "timeoutSeconds": 30,
            }
        )
        if result["status"] != "COMPLETED" or not result["measurement"]["valid"]:
            raise ValueError("Independent calibration failed correctness/execution")
        raw.append(result["measurement"])
    matrix, vector, launch = raw
    capabilities = None
    if all(m["gpu"] for m in raw):
        byte_count = 200000 * (4 if dtype == "float32" else 8) * 3
        overhead = [
            max(0, e - h - d - c) * 1000
            for e, h, d, c in zip(
                launch["gpu"]["endToEndMs"],
                launch["gpu"]["h2dMs"],
                launch["gpu"]["d2hMs"],
                launch["gpu"]["computeMs"],
            )
        ]
        capabilities = {
            "cpu_gflops": 2 * 128**3 / (matrix["cpu"]["summary"]["medianMs"] * 1e6),
            "gpu_gflops": 2 * 128**3 / (statistics.median(matrix["gpu"]["computeMs"]) * 1e6),
            "cpu_bandwidth_gbps": byte_count / (vector["cpu"]["summary"]["medianMs"] * 1e6),
            "gpu_bandwidth_gbps": byte_count
            / (statistics.median(vector["gpu"]["computeMs"]) * 1e6),
            "transfer_bandwidth_gbps": byte_count
            / (
                statistics.median(
                    [h + d for h, d in zip(vector["gpu"]["h2dMs"], vector["gpu"]["d2hMs"])]
                )
                * 1e6
            ),
            "launch_overhead_us": statistics.median(overhead),
            "parallel_fraction": 1,
            "source": "cw-independent-calibration-1; separate128-matrix/200000-vector/16-vector; "
            + dtype
            + "; one thread; logical traffic, effective rates not vendor peaks; "
            "host launch-cost proxy includes allocation/dispatch/synchronization; "
            "calibration runs excluded from training targets",
        }
    return {
        "version": "cw-independent-calibration-1",
        "dtype": dtype,
        "raw": raw,
        "capabilities": capabilities,
        "limitations": [
            "Small single-machine calibration is not theoretical peak throughput.",
            "Logical bytes are algorithmic assumptions, not hardware counters.",
            "No target-time-derived features or calibration rows train the models.",
        ],
    }


def collect(directory, include_fp64=False):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    manifest = {
        "version": "cw-collection-1",
        "provenance": "MEASURED",
        "environment": detect(),
        "runs": [],
        "calibrations": {},
        "policy": "Explicit bounded run,1 thread,10 repetitions,2 warmups,30s/job; "
        "small inputs only; no tuning; raw correctness/timing/scopes retained",
    }

    def save():
        (directory / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    save()
    for dtype in ["float32", "float64"] if include_fp64 else ["float32"]:
        cal = calibration(dtype)
        calibration_file = f"calibration-{dtype}.json"
        (directory / calibration_file).write_text(json.dumps(cal, indent=2), encoding="utf-8")
        manifest["calibrations"][dtype] = calibration_file
        save()
        for family, sizes in PLAN.items():
            for size in sizes:
                result = execute(
                    {
                        "workload": family,
                        "size": size,
                        "dtype": dtype,
                        "threads": 1,
                        "warmups": 2,
                        "repetitions": 10,
                        "timeoutSeconds": 30,
                    }
                )
                name = f"run-{len(manifest['runs']):03d}.json"
                (directory / name).write_text(json.dumps(result, indent=2), encoding="utf-8")
                manifest["runs"].append(name)
                save()
                if result["status"] != "COMPLETED":
                    raise ValueError("Collection stopped; partial raw results retained")
    return {
        "status": "COMPLETED",
        "directory": str(directory),
        "runs": len(manifest["runs"]),
        "message": "Raw measurements/calibration retained; no model trained automatically",
    }
