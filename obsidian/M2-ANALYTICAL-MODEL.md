# M2 analytical performance model

Version: **`cw-analytical-1.0.0`**. All returned results carry **`ANALYTICAL`** provenance. This is a deterministic approximation, not a measured benchmark or a trained-model prediction. Implementation: `backend/src/modules/analytical/model.ts`.

## Definitions and units

| Symbol/input              | Meaning                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| W                         | Nonnegative, safe-integer operation count **per repetition**, in FLOPs or explicitly declared FLOP-equivalent surrogate operations              |
| P                         | Fraction of operations **and traffic** that can be parallelized/offloaded, from 0 through 1                                                     |
| N                         | Positive effective/physical CPU core count; supplied explicitly or taken from the profile's physical count, never logical processors by default |
| I                         | Arithmetic intensity, FLOPs/byte; positive for W>0, optionally zero for W=0                                                                     |
| C, G                      | Aggregate whole-device CPU/GPU peak throughput, converted from GFLOP/s with **10⁹**                                                             |
| Bc, Bg                    | Whole-device CPU/GPU memory bandwidth, converted from GB/s with **10⁹**                                                                         |
| Bt                        | Host/device transfer bandwidth in decimal GB/s                                                                                                  |
| K                         | One kernel-launch overhead, converted from microseconds with **10⁻⁶**                                                                           |
| r                         | Integer repetitions, 1–10,000                                                                                                                   |
| footprint / transfer size | Binary MiB; **1 MiB = 2²⁰ bytes**, 1 GiB = 2³⁰ bytes                                                                                            |

Input size and its unit describe the workload; they do **not** independently generate operation counts or timings. Preset application fills explicit editable values. Changing N in an input description, for example, does not silently recalculate matrix operations or intensity. Device clock frequency is displayed as metadata, never converted into FLOPS.

## Roofline and memory traffic

The [original Roofline paper](https://escholarship.org/uc/item/5tz795vq) describes attainable performance as the lower of peak compute and bandwidth times intensity. CoreWise uses the same compute/memory ceiling within each modeled stage:

```text
effective throughput = min(peak throughput, memory bandwidth × I)
memory traffic D = W / I                   (D = 0 when W = 0)
stage duration = max(stage FLOPs / peak, stage bytes / bandwidth)
```

The `max` form is equivalent to dividing work by the lower roof. Compute and memory movement are assumed to overlap perfectly **within each stage**. Traffic is distinct from resident memory footprint. The model does not add footprint a second time as extra memory traffic.

## CPU methodology and Amdahl's Law

[NVIDIA's discussion of strong scaling](https://docs.nvidia.com/cuda/archive/8.0/cuda-c-best-practices-guide/index.html) describes Amdahl's limit in terms of serial and parallel work. CoreWise reports the compute-only limit separately:

```text
S(N) = 1 / ((1 − P) + P/N)
```

The user's CPU peak **C is already aggregate multicore throughput**. Assuming uniform cores, one core has peak C/N. The CPU path is modeled as a serial stage followed by a parallel stage:

```text
cpu serial compute  = W(1 − P) / (C/N)
cpu serial memory   = D(1 − P) / Bc
cpu serial stage    = max(serial compute, serial memory)

cpu parallel compute = WP / C
cpu parallel memory  = DP / Bc
cpu parallel stage   = max(parallel compute, parallel memory)

CPU time per repetition = serial stage + parallel stage
```

Compute-only time is `(W/C) × [N(1−P)+P]`, equivalently the modeled single-core compute time divided by S(N). The aggregate peak is **not** multiplied by N or divided by Amdahl speedup again. This avoids counting CPU parallelism twice. Memory-limited stages can make actual model speedup smaller than the compute-only Amdahl limit. P is treated as a fraction of uniform operation/traffic costs; real program serial-time fractions need not equal these fractions.

## GPU methodology

The non-offloadable fraction remains on one CPU core and uses the same CPU serial stage as above. The GPU only executes the offloadable fraction. Its peak is already aggregate device throughput:

```text
GPU parallel compute = WP / G
GPU parallel memory  = DP / Bg
GPU parallel stage   = max(GPU parallel compute, GPU parallel memory)

GPU path per repetition = CPU serial stage + GPU parallel stage + transfer time + K
```

No CPU-core Amdahl scaling is applied to GPU throughput. This is a sequential host-plus-accelerator pipeline, not an occupancy or GPU thread-block simulator. Device labels show user-entered hardware identity, while timing uses explicit precision-matched throughput/bandwidth assumptions.

## Transfer direction and repetitions

The caller must declare a transfer-size convention:

- **TOTAL_BYTES**: the configured transfer MiB already includes all host-to-device and device-to-host data. `transfer bytes = MiB × 2²⁰`.
- **ONE_WAY_ROUND_TRIP**: the configured MiB is one direction and the model assumes an equal-sized return transfer. `transfer bytes = 2 × MiB × 2²⁰`.

```text
transfer time = transferred bytes / (Bt × 10⁹)
total CPU/GPU duration = r × per-repetition duration
```

The GPU path always pays the declared transfer and one kernel launch **per repetition**, even when its offloadable operations are zero. This explicit policy models a submitted GPU path with no reuse/overlap optimization. Pure zero-operation work has zero compute/memory time; declared transfer and launch costs still apply. With zero transfer size, an unknown transfer bandwidth is acceptable and transfer time is zero. Zero launch overhead must be entered explicitly; missing is different from zero.

## Timing breakdown and comparison

Each device returns compute floor, full memory floor, **additional memory stall**, serial/parallel stage times, transfer, launch, per-repetition, and total times. All component totals cover all repetitions.

```text
additional memory stall = max(0, serial memory − serial compute)
                        + max(0, parallel memory − parallel compute)

total = compute floor + additional memory stall + transfer + launch
speedup ratio = total CPU time / total GPU path time
```

The charts stack compute floor and **additional stall**, not compute plus the full overlapping memory floor. Serial/parallel times are explanatory alternatives, not additional terms to add to the same total.

For configured tolerance t, ratios in **[1−t, 1+t]** mean similar estimated performance. Above that interval favors GPU; below it favors CPU. The default UI tolerance is explicitly shown as 0.05 (±5% around the time ratio 1). Both durations zero produce `speedup: null` and a similar-performance explanation; the ratio 0/0 is not invented as 1. A nonzero workload cannot produce zero GPU compute time under validated finite positive capabilities.

### Example

For W=10⁹, P=1, I=100 FLOPs/byte, C=100 GFLOP/s, Bc=100 GB/s, G=1000 GFLOP/s, and Bg=500 GB/s, CPU compute is 10 ms and GPU compute is 1 ms. Both stages are compute-bound. With no transfer/launch costs, the time ratio is 10× in favor of GPU.

Add 256 MiB **total** transfer over 12 GB/s and a 10 µs launch: transfer costs about 22.3696 ms, making the GPU path about 23.3796 ms. CPU is now estimated faster. These are illustrative calculations, not measurements of a named processor.

## Missing information, provenance, and persistence

CPU peak/bandwidth and GPU peak are never inferred from GHz, VRAM size, product names, or CUDA capability. Unknown physical CPU count requires an explicit count. The M1 GPU bandwidth and physical count may be reused, with `PROFILE_USER_ENTERED` source metadata. Every other non-null capability is identified as a `USER_ASSUMPTION`; missing values remain `NOT_SUPPLIED`. Each result stores supplied and resolved values, precision, source map, transfer convention, bytes, repetitions, tolerance, model version, preset notes, limitations, and warnings.

Missing required throughput/bandwidth/core/launch information yields an **INSUFFICIENT_DATA** recommendation and explicit missing fields. A valid CPU-only estimate can still be returned when GPU information is missing. Resident footprint exceeding declared RAM or known VRAM prevents the corresponding estimate. Entire footprint is conservatively assumed resident on the GPU; unknown VRAM emits a capacity warning. Profile capacities are user-entered decimal GB values, not measured free memory.

Preset-derived workloads carry `SYNTHETIC_DEMO` input provenance, even after editing; custom inputs carry `USER_ENTERED`. Analytical outputs always carry `ANALYTICAL`. Each saved analytical record includes immutable effective workload/hardware snapshots (including actual per-run overrides), so later edits or deletion do not rewrite history. Estimate and comparison records share one table with distinct kinds; comparison history lists the latter.

## Presets and limitations

Preset notes live with their values in `packages/types/src/m2.ts`. Matrix multiplication uses 2N³ with three FP32 matrices; vector addition uses one addition and 12 bytes per element; image convolution assumes 18 FLOPs and 8 bytes per pixel; a scientific stencil assumes 13 FP64 FLOPs and 64 bytes per cell. Sorting treats comparisons as FLOP-equivalent surrogate operations and is especially weak under a floating-point throughput model. Presets supply **no hardware peak or bandwidth guesses**.

The model omits caches, instruction mix, SIMD efficiency, occupancy, launch batching, scheduling, synchronization, contention, allocation, power/thermal behavior, NUMA, precision conversion, transfer/compute overlap, repeated-data reuse, warmup, statistical noise, and out-of-core execution. It assumes linear CPU per-core peak scaling and full declared bandwidth in each stage. Real workloads and measurements can differ substantially. Neither numerical output nor a preferred device proves actual performance or general hardware superiority. M3/ML training, SHAP, and agentic AI are not implemented by this model.
