import math
import statistics
import time
from datetime import datetime, timezone

import numpy as np
import psutil
from threadpoolctl import threadpool_info, threadpool_limits

from .detection import detect, gpu_runtime
from .schema import VERSION, Config, memory_budget


def aggregate(samples):
    if len(samples) < 3 or not all(math.isfinite(v) and v > 0 for v in samples):
        raise ValueError("At least three finite positive timing samples are required")
    return {
        "medianMs": statistics.median(samples),
        "meanMs": statistics.mean(samples),
        "stddevMs": statistics.stdev(samples),
        "minMs": min(samples),
        "maxMs": max(samples),
    }


def inputs(c):
    rng = np.random.default_rng(c.seed)
    shape = (c.size, c.size) if c.workload == "MATRIX_MULTIPLICATION" else (c.size,)
    a = rng.uniform(-1, 1, shape).astype(c.dtype)
    b = (
        rng.uniform(-1, 1, shape).astype(c.dtype)
        if c.workload not in {"SORTING", "REDUCTION"}
        else None
    )
    return a, b


def operation(module, c, a, b, out=None):
    if c.workload == "VECTOR_ADDITION":
        return module.add(a, b, out=out)
    if c.workload == "MATRIX_MULTIPLICATION":
        return module.matmul(a, b, out=out)
    if c.workload == "REDUCTION":
        return module.sum(a)
    if c.workload == "IMAGE_PROCESSING":
        summed = module.add(a, b, out=out)
        return module.multiply(summed, 0.5, out=out)
    return module.sort(a, kind="stable")


def reference(c, a, b):
    if c.workload == "SORTING":
        return np.sort(a, kind="stable")
    return operation(np, c, a.astype("float64"), b.astype("float64") if b is not None else None)


def correct(c, result, expected):
    if not np.isfinite(result).all():
        return {
            "valid": False,
            "rtol": 0,
            "atol": 0,
            "maxAbsoluteError": None,
            "diagnostic": "Non-finite output; maximum absolute error is undefined",
        }
    if c.workload == "SORTING":
        valid = bool(np.array_equal(result, expected))
        return {
            "valid": valid,
            "rtol": 0,
            "atol": 0,
            "maxAbsoluteError": float(np.max(np.abs(result - expected))),
        }
    rtol, atol = (0.005, 0.0005) if c.dtype == "float32" else (1e-10, 1e-10)
    return {
        "valid": bool(np.allclose(result, expected, rtol=rtol, atol=atol)),
        "rtol": rtol,
        "atol": atol,
        "maxAbsoluteError": float(np.max(np.abs(result - expected))),
    }


def measure(config: dict):
    c = Config.model_validate(config)
    budget = memory_budget(c)
    if budget > min(512 * 2**20, psutil.virtual_memory().available // 4):
        raise ValueError("Conservative host memory budget exceeded (512 MiB / 25% available)")
    environment = detect(probe_gpu=c.gpu)
    a, b = inputs(c)
    out = np.empty_like(a) if c.workload not in {"SORTING", "REDUCTION"} else None
    samples = []
    with threadpool_limits(limits=c.threads):
        expected = reference(c, a, b)
        for _ in range(c.warmups):
            operation(np, c, a, b, out)
        for _ in range(c.repetitions):
            start = time.perf_counter_ns()
            result = operation(np, c, a, b, out)
            samples.append((time.perf_counter_ns() - start) / 1e6)
        validation = correct(c, result, expected)
        environment["threadConfiguration"] = {
            "requestedBlasThreads": c.threads,
            "threadpools": threadpool_info(),
        }
    cpu = {
        "backend": "NumPy",
        "samplesMs": samples,
        "summary": aggregate(samples),
        "correctness": validation,
        "timingMethod": "time.perf_counter_ns",
        "scope": c.scope,
        "includesTransfers": False,
        "allocationPolicy": "preallocated arrays; sorting/reduction allocate results",
    }
    gpu = None
    gpu_error = environment["gpuUnavailableReason"] if c.gpu else "GPU benchmarking not requested"
    cp, reason = gpu_runtime() if c.gpu else (None, gpu_error)
    if cp is not None:
        try:
            if budget > cp.cuda.runtime.memGetInfo()[0] // 4:
                raise ValueError("Conservative GPU memory budget exceeded (25% free VRAM)")
            compute, h2d, d2h, end_to_end = [], [], [], []
            stream = cp.cuda.Stream.null
            # Warm all operations, including transfers and the selected kernel/library path.
            for _ in range(c.warmups):
                ga, gb = cp.asarray(a), cp.asarray(b) if b is not None else None
                gout = cp.empty_like(ga) if c.workload not in {"SORTING", "REDUCTION"} else None
                cp.asnumpy(operation(cp, c, ga, gb, gout))
            for _ in range(c.repetitions):
                stream.synchronize()
                wall = time.perf_counter_ns()
                t = time.perf_counter_ns()
                ga, gb = cp.asarray(a), cp.asarray(b) if b is not None else None
                stream.synchronize()
                h2d.append((time.perf_counter_ns() - t) / 1e6)
                gout = cp.empty_like(ga) if c.workload not in {"SORTING", "REDUCTION"} else None
                start, stop = cp.cuda.Event(), cp.cuda.Event()
                start.record()
                gr = operation(cp, c, ga, gb, gout)
                stop.record()
                stop.synchronize()
                compute.append(float(cp.cuda.get_elapsed_time(start, stop)))
                t = time.perf_counter_ns()
                host = cp.asnumpy(gr)
                stream.synchronize()
                d2h.append((time.perf_counter_ns() - t) / 1e6)
                end_to_end.append((time.perf_counter_ns() - wall) / 1e6)
            validation_gpu = correct(c, host, expected)
            if any(value <= 0 for values in [compute, h2d, d2h, end_to_end] for value in values):
                raise ValueError("GPU timing below clock resolution; no positive label available")
            chosen = compute if c.scope == "COMPUTE_ONLY" else end_to_end
            gpu = {
                "backend": "CuPy/CUDA",
                "scope": c.scope,
                "includesTransfers": c.scope == "END_TO_END",
                "samplesMs": chosen,
                "summary": aggregate(chosen),
                "computeMs": compute,
                "h2dMs": h2d,
                "d2hMs": d2h,
                "endToEndMs": end_to_end,
                "correctness": validation_gpu,
                "timingMethod": "CUDA events for compute; synchronized perf_counter_ns otherwise",
            }
            gpu_error = None
        except Exception as exc:
            gpu_error = f"GPU measurement failed: {type(exc).__name__}: {str(exc)[:500]}"
        finally:
            cp.get_default_memory_pool().free_all_blocks()
            cp.get_default_pinned_memory_pool().free_all_blocks()
    elif reason:
        gpu_error = reason
    valid = cpu["correctness"]["valid"] and (gpu is None or gpu["correctness"]["valid"])
    return {
        "benchmarkVersion": VERSION,
        "provenance": "MEASURED",
        "config": c.model_dump(),
        "environment": environment,
        "cpu": cpu,
        "gpu": gpu,
        "gpuUnavailableReason": gpu_error,
        "valid": valid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "methodology": "Setup/reference/input generation excluded; CPU operation on resident host "
        "arrays; GPU compute via CUDA events, separate synchronized transfers and end-to-end wall "
        "time. CPU sorting NumPy stable and GPU sorting CuPy stable may use different algorithms; "
        "comparison is library implementations, not identical algorithm kernels. No overlap.",
        "speedup": cpu["summary"]["medianMs"] / gpu["summary"]["medianMs"]
        if valid and gpu
        else None,
    }
