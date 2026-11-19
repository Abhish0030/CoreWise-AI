"""Versioned, unit-bearing contracts shared by ingestion and inference."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = "cw-features-1"
PROVENANCES = {"MEASURED", "USER_ENTERED", "SYNTHETIC_DEMO", "PREDICTED", "ANALYTICAL"}
ALGORITHMS = ["LINEAR", "RANDOM_FOREST", "XGBOOST"]


class Features(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)
    workload_type: str = Field(min_length=1, max_length=80)
    workload_unit: Literal["ELEMENTS", "BYTES", "MiB", "GiB", "ROWS", "PIXELS", "MATRIX_DIMENSION"]
    precision: Literal["FP32", "FP64", "FLOP_EQUIVALENT"]
    workload_size: float = Field(gt=0, le=1e12)
    operation_count: float = Field(gt=0, le=9e15)
    arithmetic_intensity: float = Field(gt=0, le=1e12)
    parallel_fraction: float = Field(ge=0, le=1)
    memory_mib: float = Field(ge=0, le=1e9)
    transfer_mib: float = Field(ge=0, le=1e9)
    cpu_cores: int = Field(ge=1, le=4096)
    cpu_frequency_ghz: float | None = Field(default=None, gt=0, le=20)
    cpu_gflops: float = Field(gt=0, le=1e8)
    cpu_bandwidth_gbps: float = Field(gt=0, le=1e6)
    gpu_gflops: float = Field(gt=0, le=1e9)
    gpu_bandwidth_gbps: float = Field(gt=0, le=1e7)
    gpu_memory_gb: float | None = Field(default=None, gt=0, le=1e6)
    transfer_bandwidth_gbps: float = Field(gt=0, le=1e6)
    launch_overhead_us: float = Field(ge=0, le=1e9)


class Record(Features):
    cpu_time_ms: float = Field(gt=0, le=1e15)
    gpu_time_ms: float = Field(gt=0, le=1e15)
    workload_family: str = Field(min_length=1, max_length=100)
    hardware_id: str = Field(min_length=1, max_length=100)
    benchmark_source: str = Field(min_length=1, max_length=500)
    measurement_methodology: str = Field(min_length=1, max_length=2000)
    provenance: Literal["MEASURED", "SYNTHETIC_DEMO"]
    dataset_version: str = Field(min_length=1, max_length=80)
    schema_version: Literal["cw-features-1"]


class DatasetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["CSV", "SYNTHETIC"]
    csv: str | None = Field(default=None, max_length=2_000_000)
    count: int = Field(default=600, ge=120, le=5000)
    seed: int = Field(default=42, ge=0, le=2147483647)

    @model_validator(mode="after")
    def csv_required(self):
        if self.mode == "CSV" and not self.csv:
            raise ValueError("CSV content is required")
        if self.mode == "SYNTHETIC" and self.csv is not None:
            raise ValueError("Synthetic generation does not accept CSV content")
        return self


class TrainingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    algorithms: list[Literal["LINEAR", "RANDOM_FOREST", "XGBOOST"]] = Field(
        default_factory=lambda: ALGORITHMS.copy(), min_length=1, max_length=3
    )
    seed: int = Field(default=42, ge=0, le=2147483647)
    group_by: Literal["CONFIGURATION", "WORKLOAD_FAMILY", "HARDWARE"] = "CONFIGURATION"


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: str = Field(min_length=1, max_length=100)
    features: Features
    cpuModelId: str | None = None
    gpuModelId: str | None = None
    hardwareProfileId: str | None = None
