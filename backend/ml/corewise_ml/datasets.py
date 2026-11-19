import csv
import io

import numpy as np
from pydantic import ValidationError

from .schema import SCHEMA_VERSION, DatasetRequest, Features, Record

OPTIONAL = {"cpu_frequency_ghz", "gpu_memory_gb"}


def validate_csv(content: str) -> list[dict]:
    if len(content.encode("utf-8")) > 2_000_000:
        raise ValueError("CSV exceeds the 2 MB limit")
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")), strict=True)
    headers = reader.fieldnames or []
    required = set(Record.model_fields) - OPTIONAL
    if len(set(headers)) != len(headers):
        raise ValueError("Duplicate CSV columns are not allowed")
    if missing := required - set(headers):
        raise ValueError("Missing required columns: " + ", ".join(sorted(missing)))
    if extra := set(headers) - set(Record.model_fields):
        raise ValueError("Unknown columns: " + ", ".join(sorted(extra)))
    rows = []
    for number, row in enumerate(reader, 2):
        if len(rows) >= 5000:
            raise ValueError("At most 5000 records are supported")
        for field in OPTIONAL:
            if not row.get(field):
                row[field] = None
        try:
            rows.append(Record.model_validate(row).model_dump())
        except ValidationError as exc:
            issue = exc.errors()[0]
            raise ValueError(f"Row {number}, {issue['loc'][0]}: {issue['msg']}") from exc
    validate_rows(rows)
    return rows


def validate_rows(rows: list[dict]):
    if len(rows) < 60:
        raise ValueError("At least 60 validated records are required for training splits")
    if len({r["provenance"] for r in rows}) != 1:
        raise ValueError("Do not mix measured and synthetic labels in one dataset")
    if len({r["dataset_version"] for r in rows}) != 1:
        raise ValueError("Use one dataset version per immutable upload")


def generate(count: int, seed: int) -> list[dict]:
    """Independent illustrative generator; never imports/calls the M2 estimator."""
    rng = np.random.default_rng(seed)
    families = ["dense", "vector", "sort", "image", "stencil", "reduction"]
    types = [
        "MATRIX_MULTIPLICATION",
        "VECTOR_ADDITION",
        "SORTING",
        "IMAGE_PROCESSING",
        "SCIENTIFIC_COMPUTATION",
        "CUSTOM",
    ]
    rows = []
    for i in range(count):
        family = i % 6
        hardware = int(rng.integers(0, 12))
        cores = [4, 8, 16, 32][hardware % 4]
        cpu = (80 + hardware * 65) * (0.5 if family == 4 else 1)
        gpu = (800 + hardware * 1100) * (0.3 if family == 4 else 1)
        size = float(10 ** rng.uniform(3, 8))
        intensity = float(10 ** rng.uniform(-1.5, 2.5))
        # Variable pass count prevents workload size from perfectly encoding operation count.
        passes = int(rng.integers(1, 33))
        operations = float(size * [1200, 1, 20, 18, 13, 3][family] * passes)
        memory = float(size * [12, 12, 8, 8, 64, 4][family] / 2**20)
        transfer = memory * float(rng.choice([0, 0.25, 1, 2]))
        parallel = float(rng.uniform(0.2, 0.999))
        cb, gb, tb = 25 + hardware * 8, 100 + hardware * 75, 4 + hardware * 2
        launch = 5 + hardware % 3 * 8
        # Saturating CPU scaling, family-specific efficiency, nonlinear cache/occupancy penalties.
        cpu_eff = [0.65, 0.75, 0.25, 0.55, 0.7, 0.6][family]
        gpu_eff = [0.8, 0.65, 0.12, 0.7, 0.65, 0.4][family]
        cache_penalty = 1 + 0.25 * np.log1p(memory / 16)
        cpu_ms = 1000 * (
            operations
            / (cpu * 1e9 * cpu_eff)
            * (cores * (1 - parallel) + parallel * (1 + 0.02 * cores))
            + operations / intensity / (cb * 1e9) * cache_penalty
        )
        occupancy = 0.15 + 0.85 * (1 - np.exp(-size / 1e6))
        gpu_ms = 1000 * (
            operations * (1 - parallel) * cores / (cpu * 1e9 * cpu_eff)
            + operations * parallel / (gpu * 1e9 * gpu_eff * occupancy)
            + operations * parallel / intensity / (gb * 1e9)
            + transfer * 2**20 / (tb * 1e9)
            + launch * 1e-6
        )
        # Positive multiplicative lognormal noise, independent for CPU/GPU; no target as feature.
        noise = rng.lognormal(-(0.08**2) / 2, 0.08, 2)
        row = dict(
            workload_type=types[family],
            workload_unit="ELEMENTS",
            precision="FP64" if family == 4 else "FP32",
            workload_size=size,
            operation_count=operations,
            arithmetic_intensity=intensity,
            parallel_fraction=parallel,
            memory_mib=memory,
            transfer_mib=transfer,
            cpu_cores=cores,
            cpu_frequency_ghz=2.4 + hardware * 0.1,
            cpu_gflops=cpu,
            cpu_bandwidth_gbps=cb,
            gpu_gflops=gpu,
            gpu_bandwidth_gbps=gb,
            gpu_memory_gb=[4, 8, 16, 24][hardware % 4],
            transfer_bandwidth_gbps=tb,
            launch_overhead_us=launch,
            cpu_time_ms=float(cpu_ms * noise[0]),
            gpu_time_ms=float(gpu_ms * noise[1]),
            workload_family=families[family],
            hardware_id=f"synthetic-config-{hardware}",
            benchmark_source="CoreWise independent synthetic generator v1",
            measurement_methodology="Simulated equations + lognormal noise; not measured",
            provenance="SYNTHETIC_DEMO",
            dataset_version=f"synthetic-v1-seed-{seed}",
            schema_version=SCHEMA_VERSION,
        )
        rows.append(Record.model_validate(row).model_dump())
    return rows


def ingest(request: DatasetRequest):
    rows = (
        generate(request.count, request.seed)
        if request.mode == "SYNTHETIC"
        else validate_csv(request.csv or "")
    )
    return {
        "rows": rows,
        "rowCount": len(rows),
        "provenance": rows[0]["provenance"],
        "version": rows[0]["dataset_version"],
        "schemaVersion": SCHEMA_VERSION,
        "validation": {
            "valid": True,
            "optionalPolicy": "CPU frequency/GPU capacity: train-only median + missing indicators",
            "labelPolicy": "MEASURED is uploader-attested; no independent verification",
            "featureColumns": list(Features.model_fields),
        },
    }
