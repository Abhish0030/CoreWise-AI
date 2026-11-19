from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

VERSION = "cw-bench-1"
LIMITS = {
    "VECTOR_ADDITION": 4_000_000,
    "MATRIX_MULTIPLICATION": 1024,
    "SORTING": 1_000_000,
    "REDUCTION": 1_000_000,
    "IMAGE_PROCESSING": 4_000_000,
}


class Config(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    workload: Literal[
        "VECTOR_ADDITION", "MATRIX_MULTIPLICATION", "SORTING", "REDUCTION", "IMAGE_PROCESSING"
    ]
    size: int = Field(ge=16, le=4_000_000)
    dtype: Literal["float32", "float64"] = "float32"
    warmups: int = Field(default=2, ge=1, le=5)
    repetitions: int = Field(default=5, ge=3, le=30)
    seed: int = Field(default=42, ge=0, le=2147483647)
    threads: int = Field(default=1, ge=1, le=16)
    gpu: bool = True
    scope: Literal["COMPUTE_ONLY", "END_TO_END"] = "END_TO_END"
    timeoutSeconds: int = Field(default=60, ge=5, le=120)

    @model_validator(mode="after")
    def size_limit(self):
        if self.size > LIMITS[self.workload]:
            raise ValueError(f"{self.workload} size exceeds {LIMITS[self.workload]}")
        return self


def memory_budget(config: Config):
    elements = config.size**2 if config.workload == "MATRIX_MULTIPLICATION" else config.size
    # Conservative headroom: host arrays, float64 reference, intermediates and validation copies.
    return elements * (8 if config.dtype == "float64" else 4) * 12
