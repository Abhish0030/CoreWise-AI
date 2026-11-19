# Synthetic demonstration generator v1

**Demonstration dataset — not measured hardware performance.**

The fixed-seed NumPy generator in `corewise_ml/datasets.py` creates every feature and both labels. It does not import, invoke, or copy M2 estimates. It shares broad compute/memory/serial/transfer concepts with analytical models, so success measures recovery of these simulated relationships, not independent evidence of hardware accuracy. No CPU/GPU is benchmarked. Each record is `SYNTHETIC_DEMO`, schema `cw-features-1`, dataset version `synthetic-v1-seed-{seed}`. The immutable dataset ID distinguishes count/upload versions.

## Features and ranges

- Six rotating families: dense/matrix multiplication, vector/vector addition, sort/sorting, image/image processing, stencil/scientific computation, reduction/custom. `workload_unit=ELEMENTS` for all generated sizes; a matrix's size here denotes elements, not its dimension. Other units require a compatible uploaded training dataset.
- Hardware index h is uniform integer 0–11. Hardware ID is `synthetic-config-h`; these are invented configurations, not commercial processor identities. Core count N cycles [4,8,16,32]. CPU frequency is 2.4+0.1h GHz. It is an independent feature, never used to infer FLOPS.
- Precision is FP64 for stencil, FP32 otherwise. Aggregate effective CPU throughput C=(80+65h) GFLOP/s, multiplied by 0.5 for stencil. GPU throughput G=(800+1100h), multiplied by 0.3 for stencil. These are declared generator parameters, not verified device capabilities.
- CPU bandwidth Bc=25+8h GB/s; GPU bandwidth Bg=100+75h GB/s; host-device bandwidth Bt=4+2h GB/s. GPU capacity cycles [4,8,16,24] decimal GB. Launch overhead K cycles [5,13,21] microseconds.
- Size s=10^U(3,8) elements. Operation count W=s×family-operation-factor×passes, factors [1200,1,20,18,13,3], passes uniform integer 1–32. Variable pass count prevents size from deterministically encoding W within each family. These operation surrogates do not claim literal implementations of named kernels.
- Arithmetic intensity I=10^U(-1.5,2.5) FLOPs/byte, independent of footprint. Parallel fraction P=U(0.2,0.999). Resident footprint M=s×bytes-per-element/2²⁰ MiB, factors [12,12,8,8,64,4]. Transfer T=M×choice([0,0.25,1,2]) MiB, already **total** bidirectional bytes. Footprint is descriptive; generated cases do not implement allocation or out-of-core execution. Some hypothetical footprints can exceed generated GPU capacity; these are a generator limitation, not successful execution evidence. The prediction API rejects saved workloads exceeding known profile VRAM.
- CPU/GPU times are positive end-to-end **milliseconds per invocation**. Dataset version, feature-schema version, source, methodology, family, hardware ID and provenance are metadata, excluded from model inputs except workload category. They are used for auditing and splitting, not target shortcuts.

## Equations

All decimal bandwidth/throughput values convert with 10⁹; MiB with 2²⁰; microseconds with 10⁻⁶. Set:

```text
cpuEfficiency = [0.65, 0.75, 0.25, 0.55, 0.70, 0.60][family]
gpuEfficiency = [0.80, 0.65, 0.12, 0.70, 0.65, 0.40][family]
cachePenalty  = 1 + 0.25 ln(1 + M/16)
occupancy     = 0.15 + 0.85 (1 − exp(−s/10⁶))

CPU_ms = 1000 × [ W/(C×10⁹×cpuEfficiency) × (N(1−P)+P(1+0.02N))
                 + (W/I)/(Bc×10⁹) × cachePenalty ]

GPU_ms = 1000 × [ W(1−P)N/(C×10⁹×cpuEfficiency)
                 + WP/(G×10⁹×gpuEfficiency×occupancy)
                 + (WP/I)/(Bg×10⁹)
                 + T×2²⁰/(Bt×10⁹) + K×10⁻⁶ ]
```

The CPU and GPU paths deliberately use additive compute and memory costs, family efficiencies, saturation and nonlinear penalties; this is a different data-generating model from M2's max/roofline stages. There is no transfer overlap. The GPU path includes host serial work. CPU-favorable small/transfer-heavy cases and GPU-favorable parallel/compute-heavy cases both occur.

Independent multiplicative noise on each target is `exp(Normal(−σ²/2, σ²))`, σ=0.08. Its mean is one; targets remain positive. Fixed NumPy seed makes draws, cases and noise reproducible for pinned dependencies. No measurement uncertainty is inferred from this simulated noise.

## Limits

No scheduling, real cache hierarchy, instruction set, actual occupancy, thermal behavior, transfer contention, library implementation, hardware verification, out-of-core policy or observed runtime distribution is captured. Metadata cannot turn this generator into a measurement. Random held-out configurations, held-out families and held-out hardware test different simulation generalization questions; none establishes real hardware accuracy. R² can be negative and errors can be large. All reported metrics come from fitting and held-out predictions, never constants. Do not train on M2 outputs labeled MEASURED, or use these artifacts as benchmark ground truth for M4.
