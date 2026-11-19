# M4 local benchmark methodology

Version **cw-bench-1**. This milestone executes actual allowlisted operations on an explicitly authorized local device. It does not implement continuous monitoring, fan/voltage/clock controls, SHAP, an assistant, or M7 reports. Browser pages do not detect hardware or execute kernels.

## Installation and explicit execution

From the repository root (Python 3.13, Windows examples):

```powershell
python -m venv backend/local-agent/.venv
backend/local-agent/.venv/Scripts/python -m pip install -r backend/local-agent/requirements.lock.txt
# Optional supported NVIDIA CUDA 13 backend; sizeable vendor runtime downloads:
backend/local-agent/.venv/Scripts/python -m pip install -r backend/local-agent/requirements-gpu.lock.txt
pnpm agent detect
```

On POSIX use `.venv/bin/python`; direct pinned requirements are also provided for resolving the platform's native keyring dependencies. CPU operation requires no CUDA package. The tested dependency closures are pinned separately for CPU and optional GPU. `pip check` verifies compatibility; NumPy/CuPy versions and peer bounds were checked against package registry metadata before installation.

Start CoreWise with the existing setup/migrations and `pnpm dev`. In `/benchmark-lab`, generate a one-time pairing code. On the trusted device:

```powershell
pnpm agent pair --url http://127.0.0.1:4000
# Paste the code at the hidden prompt. No benchmark starts during pairing.
# Queue a specific job in Benchmark Lab, then explicitly authorize one execution:
pnpm agent run --execute
```

For a bounded offline measurement (no account, no network submission):

```powershell
pnpm agent local --execute --workload VECTOR_ADDITION --size 100000 --output backend/local-agent/results/vector.json
pnpm agent local --execute --workload MATRIX_MULTIPLICATION --size 128 --output backend/local-agent/results/matrix.json
pnpm agent local --execute --workload SORTING --size 10000 --output backend/local-agent/results/sort.json
```

`--cpu-only`, `--repetitions` and `--scope` are supported. Other runner commands are argparse allowlisted. There is no shell/Python source execution interface. Offline execution still requires `--execute`, size/memory limits, a subprocess deadline and the OS execution lock. Generated local results contain device metadata and are ignored by Git.

## Hardware detection and provenance

CPU model comes from the Windows registry, Linux `/proc/cpuinfo` or the platform processor API. psutil supplies physical/logical counts, available/total RAM and OS metadata. Unknown values remain null. GPU identity/memory/driver information comes from fixed `nvidia-smi` queries when available; a successful CuPy allocation and kernel probe establish runtime availability. Device 0 is the supported GPU. Record actual CUDA runtime/driver versions separately from installed wheel versions. No model-name-to-FLOPS lookup or GHz-derived throughput is performed.

Detection is labeled **DETECTED**, independent of the M1 USER_ENTERED hardware library. Agent environment metadata is runner-reported, not hardware-attested. Valid timing records carry **MEASURED**; synthetic M0/M3 demonstrations remain separate. A paired device can still lie or be compromised; TLS and credential ownership authenticate the reporter, not physical truth or absence of background load.

## Workload implementations

All inputs are deterministic NumPy uniform [-1,1] arrays generated from the saved seed, outside timing. Both devices receive the same input values. float32 and float64 are supported.

| Workload                    | Semantics / dimensions                  | CPU                            | Optional GPU                                     | Maximum size |
| --------------------------- | --------------------------------------- | ------------------------------ | ------------------------------------------------ | -----------: |
| Vector addition             | c[i]=a[i]+b[i], N elements              | NumPy add, preallocated output | CuPy add, preallocated output for compute timing |    4,000,000 |
| Dense matrix multiplication | C=A@B, N×N matrices                     | NumPy matmul / installed BLAS  | CuPy matmul / CUDA library                       |       N=1024 |
| Sorting                     | Ascending stable value sort, N elements | NumPy stable sort              | CuPy stable sort when supported                  |    1,000,000 |

Sorting includes output allocation and compares library implementations. NumPy/CuPy may choose different underlying algorithms; this is explicitly reported. Sorting is not presented as identical algorithm kernels or floating-point instruction throughput. Array layout is contiguous, seed/type/dimensions are recorded, and setup/reference generation is excluded. Installed BLAS/library versions and threadpool metadata are preserved. `threadpoolctl` limits BLAS threads (1–16 requested); this does not imply that non-BLAS NumPy operations use that many cores or control OS scheduling.

## Timing and scope

Warmups: 1–5 (default 2), excluded from samples. Repetitions: 3–30 (default 5). CPU timing uses `time.perf_counter_ns()` around each operation and returns milliseconds. Inputs and nonsorting output arrays are already allocated. Sorting allocates its result inside the operation. Resident-host operation time is the CPU execution boundary for both scopes; it excludes input generation/setup and has no host-device transfer.

GPU warmup includes upload, operation and download. Each measured repetition synchronizes the stream first, then records:

1. Host-to-device wall time: CuPy array upload/allocation plus synchronization.
2. Compute time: CUDA events around the operation; wait on the stop event and use supported elapsed-event timing.
3. Device-to-host wall time: host output allocation/download plus synchronization.
4. End-to-end wall time: the complete upload, output allocation, event/dispatch, compute synchronization and download path, measured with perf_counter_ns.

End-to-end is measured independently; it is not fabricated by adding component medians. Event times and wall times have different overheads/resolution. Python enqueue gaps, allocation, runtime/library initialization, synchronization and caching can affect results even after warmup. No overlap or data reuse is assumed between measured invocations.

`COMPUTE_ONLY` selects resident CPU operation vs GPU event timings; `END_TO_END` selects resident CPU operation vs the GPU host/accelerator round trip. Scope and transfer inclusion are explicit in raw records and UI. CPU end-to-end is not mislabeled as including a nonexistent transfer. Do not compare a CPU end-to-end result to a GPU compute-only result from another scope without an explicit warning. The server requires both selected scopes to match before computing CPU median/GPU median speedup. A ratio is a measurement of this run's boundaries, not a general recommendation or universal device advantage.

Raw timing samples are persisted. Summary statistics are median, arithmetic mean, sample standard deviation (n−1), minimum and maximum. The server independently recomputes statistics and rejects inconsistent summaries, wrong sample counts, mismatched job configuration, nonfinite/nonpositive target samples, wrong backend/transfer policy, incomplete GPU components or terminal-job replacement.

## Correctness

Vector/matrix outputs are compared to float64 NumPy reference calculations on identical inputs. float32 uses rtol=0.005 and atol=0.0005; float64 uses 1e−10 for both. These are explicit bounded-workload tolerances, not a proof against every numerical error. Sorting uses exact equality to the stable NumPy reference value array; duplicates' original index ordering is not compared because indices are not part of this benchmark's output.

Nonfinite output is invalid, with undefined maximum error represented as null. Failed correctness retains samples, environment and diagnostics but the server derives `valid=false`, marks the job INVALID and excludes it from supervised export. Backend errors preserve the CPU result and a GPU-unavailable diagnostic when possible. GPU absence never produces an invented target or ratio. Malformed measurements are rejected rather than admitted as valid evidence.

## Bounds, cancellation and cleanup

Config values are validated independently in shared Zod and Python Pydantic contracts. Maximum sizes above, 3–30 repetitions, 1–5 warmups, 1–16 BLAS threads and 5–120 second subprocess deadlines bound work. A conservative 12-array byte estimate must fit both 512 MiB and 25% of currently available host RAM; GPU headroom must fit 25% of free VRAM. These are allocation checks, not an absolute process RSS/power cap; native runtime/context memory and concurrent applications also consume resources.

A per-OS-user file lock prevents concurrent benchmark children, including separate CLI invocations. PostgreSQL also permits one pending/running job per runner. The supervisor uses a spawned child, polls cancellation and terminates/kills/joins the child on cancellation, timeout or local interruption. Normal GPU paths release CuPy pools; process exit releases native resources. A stalled driver/OS may delay physical resource reclamation after process termination.

Queued cancellation is immediate. Running cancellation is polled by the outbound runner about once per second between supervisor waits; no inbound command service is opened. Unresponsive/disconnected runners leave jobs until their fixed timeout+90-second lease expires, at which point an owned status poll fails the job. No work is automatically retried or started on application launch. `run --execute` consumes at most one job and exits. Browser queueing and local execution are separate explicit actions.

## Pairing and credential security

Signed-in users create a 256-bit random one-time code valid for ten minutes. Only a SHA-256 hash is stored. Redemption is transactional and single-use; it creates a 90-day opaque runner credential, also stored as a hash. Codes remain temporary React state and are pasted at a hidden local prompt; neither codes nor long-lived tokens go to frontend localStorage. Redemption attempts are rate limited.

The CLI accepts HTTPS origins for remote communication and HTTP only for loopback development. Redirect following and URL userinfo/path/query are refused. Express refuses non-TLS remote runner calls and all production HTTP runner calls; trusted TLS-proxy configuration follows the existing application setup.

Credential storage uses the native Windows Credential Manager/macOS Keychain/Secret Service/KWallet through keyring. Plaintext or unsupported fallback backends are refused. Only nonsensitive origin/agent-ID metadata is stored in the local configuration file. A missing/locked vault fails closed; if persistence fails after redemption, revoke the displayed device in the UI and pair again. Pairing does not start a benchmark.

Each runner request first uses the existing CSRF bootstrap and an ephemeral cookie jar. The bearer credential establishes a regenerated **database-backed, runner-only session** without a personal userId. Subsequent writes require the session-bound CSRF header. Agent ID, owner, revocation and expiry are rechecked server-side; runner sessions cannot read hardware libraries, models or personal APIs. They can only claim their assigned allowlisted job, poll it and submit its result. Revocation immediately invalidates existing runner access and cancels pending work. No unauthenticated listener or arbitrary command endpoint is added.

## ML dataset integration

Raw CSV exports preserve individual samples, CPU-only/invalid records, scope, dimensions, dtype, full config/environment and diagnostics. Missing GPU targets remain blank. Raw benchmark CSV is intentionally distinct from training-ready `cw-features-1` CSV.

For M3 export, select only valid paired END_TO_END runs. Each repetition contributes its actual CPU and GPU end-to-end samples, with matching schema/version/provenance and source run ID. Repeated inputs remain the same evaluation group under M3's existing grouped splitting. No target is duplicated to satisfy dataset counts. At least 60 actual paired samples are needed to save a dataset; training additionally requires at least six groups. Export readiness checks both count and group diversity; saving data does not promise successful generalization.

Operation-count features use N for addition, 2N³ for matrix multiplication, and N log₂N FLOP-equivalent comparisons for sorting. Footprint/transfer features use three arrays for addition/matmul and two for sorting, with binary MiB. Arithmetic intensity uses this idealized traffic assumption; it is not a measured hardware-counter value. Sorting precision is FLOP_EQUIVALENT. CPU frequency remains unknown, rather than parsed from a CPU name; optional GPU capacity comes from detected device bytes. A stable SHA-256 hardware/configuration ID includes CPU/GPU identity, physical count, requested BLAS threads and OS.

Effective CPU/GPU throughput, CPU/GPU/transfer bandwidth, launch overhead and parallel fraction are not independently calibrated by this catalog. They must be supplied with an explicit external source, labeled USER_ENTERED metadata. **Never derive these features from the same target times**, infer them from GHz/model names, or fill unknowns with defaults. Missing critical capabilities, GPU targets, wrong scope or invalid correctness exclude rows with a reason. Export never manufactures GPU values to pair a CPU-only result.

`POST /api/benchmarks/datasets` sends the completed CSV through the existing private M3 ingestion validator and saves an owned MEASURED Dataset selectable on `/ml-predictions`. Synthetic and measured datasets cannot be blended. Supplying source text does not establish independent calibration; users are responsible for accurate capability metadata. Browser integration tests use explicitly labeled test-only USER_ENTERED schema assumptions, never claim those inputs as hardware calibration, and delete their exact fixture dataset afterward.

## Limitations and verification

Measurements depend on foreground/background load, power management, thermal state, software versions, paging, BLAS and CUDA cache state, allocation and OS scheduling. This machine is a laptop with limited RAM; example timings are small validation runs, not a controlled performance study. No clock/fan controls or automatic stress workloads are used. Native CUDA support is optional and unsupported devices retain CPU data. GPU-dependent tests skip only after a real backend probe fails, with the reason recorded.

The runner and API trust authenticated device reports; no hardware attestation, sandbox for malicious local administrators, continuous sensor telemetry, remote deployment/TLS certification or statistical benchmark certification is claimed. See STATUS for actual CPU/GPU runs, test outcomes and retained review files.

Primary references: [NumPy sort](https://numpy.org/doc/stable/reference/generated/numpy.sort.html), [NumPy threading](https://numpy.org/doc/stable/user/basics.performant_code.html), [CuPy CUDA events](https://docs.cupy.dev/en/stable/reference/generated/cupy.cuda.Event.html), [psutil APIs](https://psutil.readthedocs.io/stable/). The code records installed/runtime versions instead of assuming the latest vendor behavior.
