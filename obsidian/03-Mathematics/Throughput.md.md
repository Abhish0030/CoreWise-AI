---

title: Throughput  
project: CoreWise AI  
category: Mathematics  
tags:

- throughput
    
- FLOPS
    
- CPU
    
- GPU
    
- performance
    
- benchmarking  
    status: Research
    

---

# Throughput

## 1. Introduction

Throughput is a performance metric that measures the amount of computational work completed by a processor within a specific period.

It is commonly used to evaluate CPUs, GPUs, servers, networks, and high-performance computing systems.

In processor architecture, throughput helps determine how efficiently hardware processes instructions, operations, or workloads.

### Why Throughput Is Important

Throughput helps us understand:

- How many operations a processor completes per second.
    
- How efficiently a CPU or GPU processes data.
    
- How much computational work hardware can handle.
    
- How processor performance changes with workload size.
    
- Whether a system can handle multiple tasks efficiently.
    

**CoreWise AI perspective:** Throughput can be used alongside execution time to compare CPU and GPU performance and evaluate how much work each processor completes within a given time.

---

## 2. Basic Definition

Throughput is the amount of work completed divided by the time required.

Throughput=Total Work CompletedTotal Time\boxed{ Throughput=\frac{Total\ Work\ Completed}{Total\ Time} }

Where:

- Total Work Completed = Number of operations or tasks completed.
    
- Total Time = Time required to complete the work.
    

### Example

Suppose a processor completes 10,000 operations in 5 seconds.

Throughput=10,0005Throughput=\frac{10,000}{5} Throughput=2,000 operations/second\boxed{Throughput=2,000\ operations/second}

The processor completes 2,000 operations every second.

---

## 3. Units of Throughput

Throughput can be expressed using different units depending on the workload.

|Unit|Meaning|
|---|---|
|Operations/second|Number of operations completed per second|
|Instructions/second|Number of instructions executed per second|
|FLOPS|Floating-point operations per second|
|Images/second|Number of images processed per second|
|Samples/second|Number of samples processed per second|
|Requests/second|Number of requests handled per second|
|Tokens/second|Number of AI-generated tokens per second|
|GB/s|Amount of data transferred per second|

The correct unit depends on the type of computational workload being evaluated.

---

## 4. Floating-Point Operations Per Second (FLOPS)

FLOPS measures the number of floating-point operations performed per second.

It is an important metric for evaluating the computational capability of CPUs and GPUs.

Floating-point operations include:

- Floating-point addition.
    
- Floating-point subtraction.
    
- Floating-point multiplication.
    
- Floating-point division.
    

### Formula

FLOPS=Total Floating Point OperationsExecution Time\boxed{ FLOPS=\frac{Total\ Floating\ Point\ Operations}{Execution\ Time} }

### Example

Suppose a processor performs 1 billion floating-point operations in 2 seconds.

FLOPS=1,000,000,0002FLOPS=\frac{1,000,000,000}{2} FLOPS=500,000,000\boxed{FLOPS=500,000,000}

Therefore, the processor achieves 500 million floating-point operations per second.

---

## 5. Common FLOPS Units

|Unit|Equivalent|
|---|--:|
|FLOPS|1 operation/second|
|KFLOPS|10310^3 FLOPS|
|MFLOPS|10610^6 FLOPS|
|GFLOPS|10910^9 FLOPS|
|TFLOPS|101210^{12} FLOPS|
|PFLOPS|101510^{15} FLOPS|
|EFLOPS|101810^{18} FLOPS|

### Example

If a GPU achieves 10 TFLOPS:

10 TFLOPS=10×101210\ TFLOPS=10\times10^{12} 1013 FLOPS\boxed{10^{13}\ FLOPS}

This represents a theoretical or measured floating-point processing rate, depending on how the value was obtained.

**Important:** Peak FLOPS does not guarantee that a real application will achieve the same performance. Actual throughput depends on memory bandwidth, workload characteristics, hardware utilization, and instruction types.

---

## 6. CPU Throughput

CPU throughput measures how much computational work a CPU completes per unit of time.

It depends on:

- Number of physical cores.
    
- Clock frequency.
    
- Instructions per cycle (IPC).
    
- Instruction mix.
    
- Memory performance.
    
- Thread scheduling.
    
- Parallel execution efficiency.
    

### Instructions Per Second

A simplified instruction throughput model is:

IPS=IPC×fIPS=IPC\times f

Where:

- IPS = Instructions per second.
    
- IPC = Average instructions completed per cycle.
    
- ff = Clock frequency in cycles per second.
    

### Example

Suppose:

- IPC = 2.
    
- CPU frequency = 3 GHz.
    

IPS=2×3×109IPS=2\times3\times10^9 IPS=6×109 instructions/second\boxed{IPS=6\times10^9\ instructions/second}

This is a simplified single-core estimate under the assumed IPC and frequency.

For a multicore CPU, aggregate throughput depends on how efficiently the workload uses multiple cores. It cannot always be calculated by simply multiplying single-core throughput by the core count.

---

## 7. GPU Throughput

GPU throughput measures the amount of computational work completed by a GPU per unit of time.

GPUs are designed to execute large numbers of parallel operations.

GPU throughput depends on:

- Number of processing units.
    
- GPU clock frequency.
    
- Floating-point execution capability.
    
- Memory bandwidth.
    
- Thread configuration.
    
- Occupancy.
    
- Instruction type.
    
- Workload parallelism.
    

### Example

Suppose a GPU performs 20 billion operations in 4 seconds.

Throughput=20×1094Throughput=\frac{20\times10^9}{4} Throughput=5×109 operations/second\boxed{Throughput=5\times10^9\ operations/second}

The GPU achieves 5 billion operations per second for the measured workload.

---

## 8. CPU vs GPU Throughput

CPU and GPU throughput can be compared by executing the same workload on both processors.

|Parameter|CPU|GPU|
|---|---|---|
|Processing Design|General-purpose processing|Parallel processing|
|Execution Units|CPU cores|GPU execution units|
|Throughput|Often suitable for sequential and mixed workloads|Often high for data-parallel workloads|
|Memory System|System RAM and cache|Device memory and GPU caches|
|Main Performance Factors|IPC, frequency, cores, cache|Parallelism, bandwidth, occupancy|
|Suitable Workloads|Control-heavy and sequential tasks|Large parallel computational tasks|

### Example

Suppose a workload produces:

CPU:

ThroughputCPU=2,000 operations/sThroughput_{CPU}=2,000\ operations/s

GPU:

ThroughputGPU=8,000 operations/sThroughput_{GPU}=8,000\ operations/s

The GPU provides higher throughput for this workload.

However, the comparison must use the same operation definition and equivalent measurement boundaries.

---

## 9. Throughput vs Execution Time

Throughput and execution time are related but represent different performance characteristics.

### Execution Time

Measures how long a particular workload takes to complete.

T=Total WorkThroughputT=\frac{Total\ Work}{Throughput}

### Throughput

Measures how much work is completed per unit of time.

Throughput=Total WorkExecution TimeThroughput=\frac{Total\ Work}{Execution\ Time}

### Comparison

|Parameter|Execution Time|Throughput|
|---|---|---|
|Meaning|Time required to complete work|Work completed per unit time|
|Objective|Minimize|Maximize|
|Unit|Seconds, milliseconds|Operations/s, tasks/s|
|Focus|Completion speed|Processing capacity|
|CoreWise AI Use|Predict workload completion|Evaluate processing rate|

### Example

Suppose two processors complete the same workload of 1,000 operations.

CPU:

TCPU=10 secondsT_{CPU}=10\ seconds

GPU:

TGPU=2 secondsT_{GPU}=2\ seconds

CPU throughput:

100010=100 operations/s\frac{1000}{10}=100\ operations/s

GPU throughput:

10002=500 operations/s\frac{1000}{2}=500\ operations/s

The GPU achieves five times the throughput for this workload.

---

## 10. Memory Bandwidth and Throughput

Memory bandwidth measures how much data can be transferred per unit of time.

It is particularly important for memory-intensive workloads.

Memory Bandwidth=Data TransferredTransfer Time\boxed{ Memory\ Bandwidth= \frac{Data\ Transferred}{Transfer\ Time} }

### Example

Suppose a GPU transfers 16 GB of data in 4 seconds.

Bandwidth=164Bandwidth=\frac{16}{4} Bandwidth=4 GB/s\boxed{Bandwidth=4\ GB/s}

### Importance

A processor may have high computational throughput but low effective application performance if memory cannot supply data quickly enough.

Therefore, CoreWise AI should consider both computational throughput and memory bandwidth.

---

## 11. Arithmetic Intensity and Computational Throughput

Arithmetic intensity measures how many floating-point operations are performed per byte transferred.

AI=FLOPsBytes Transferred\boxed{ AI=\frac{FLOPs}{Bytes\ Transferred} }

Where:

- AI = Arithmetic intensity.
    
- FLOPs = Floating-point operations.
    
- Bytes Transferred = Total data movement.
    

### Example

Suppose a workload performs:

- 10 million floating-point operations.
    
- 2 million bytes of memory transfer.
    

AI=10,000,0002,000,000AI=\frac{10,000,000}{2,000,000} AI=5 FLOPs/Byte\boxed{AI=5\ FLOPs/Byte}

Higher arithmetic intensity indicates more computation relative to data movement.

This helps determine whether a workload is more likely to be limited by computational throughput or memory bandwidth.

---

## 12. Throughput in Machine Learning

Throughput is especially important in AI and machine learning workloads.

Different AI workloads use different throughput metrics.

### 12.1 Training Throughput

Training throughput measures how many samples a model processes per second.

Training Throughput=Number of SamplesTraining TimeTraining\ Throughput= \frac{Number\ of\ Samples}{Training\ Time}

### 12.2 Inference Throughput

Inference throughput measures how many inputs a model processes per second.

Inference Throughput=Number of PredictionsInference TimeInference\ Throughput= \frac{Number\ of\ Predictions}{Inference\ Time}

### 12.3 Token Throughput

For language models, token throughput measures how many tokens are generated per second.

Token Throughput=Generated TokensGeneration TimeToken\ Throughput= \frac{Generated\ Tokens}{Generation\ Time}

### 12.4 Image Processing Throughput

Image Throughput=Number of ImagesProcessing TimeImage\ Throughput= \frac{Number\ of\ Images}{Processing\ Time}

These metrics can help CoreWise AI evaluate different processor configurations for AI workloads.

---

## 13. Throughput Measurement

A reliable throughput measurement requires:

1. A clearly defined workload.
    
2. A known quantity of completed work.
    
3. A consistent measurement interval.
    
4. Appropriate timing mechanisms.
    
5. Repeated benchmark runs.
    

### Python Example

```python
import time

total_operations = 10_000_000

start = time.perf_counter()

result = sum(range(total_operations))

end = time.perf_counter()

execution_time = end - start

throughput = total_operations / execution_time

print("Execution Time:", execution_time, "seconds")
print("Throughput:", throughput, "operations/second")
```

**Note:** This example counts loop iterations, not actual CPU instructions or floating-point operations. A real FLOPS benchmark requires counting the floating-point operations performed by the workload.

---

## 14. Throughput in CoreWise AI

CoreWise AI can use throughput as an additional metric when evaluating processor performance.

### Proposed Input Features

|Category|Features|
|---|---|
|CPU|Core count, frequency, IPC|
|GPU|SM count, clock frequency, execution capability|
|Memory|Bandwidth, latency, memory utilization|
|Workload|Input size, operation count, arithmetic intensity|
|Runtime|Execution time, utilization, completed operations|

### Proposed Prediction Targets

ThroughputCPU=OperationsTCPUThroughput_{CPU}= \frac{Operations}{T_{CPU}} ThroughputGPU=OperationsTGPUThroughput_{GPU}= \frac{Operations}{T_{GPU}}

The system can compare these values to understand the processing capacity of each processor for a particular workload.

### Recommended Output

```json
{
  "workload": "Matrix Multiplication",
  "cpu_execution_time": 2.0,
  "gpu_execution_time": 0.5,
  "cpu_throughput": 500000,
  "gpu_throughput": 2000000,
  "throughput_unit": "operations/second",
  "recommended_processor": "GPU"
}
```

_Illustrative example only. Real throughput values must be calculated from measured operations and execution time._

---

## 15. Important Considerations

1. Throughput depends on the definition of completed work.
    
2. CPU and GPU must execute equivalent workloads.
    
3. Peak FLOPS should not be confused with actual application throughput.
    
4. Memory bandwidth can limit computational throughput.
    
5. Small workloads may produce misleading throughput measurements.
    
6. Multiple benchmark runs improve reliability.
    
7. AI workloads may require samples/second or tokens/second rather than FLOPS.
    
8. Execution time and throughput should be reported together for meaningful analysis.
    

---

## 16. Key Takeaways

1. Throughput measures completed work per unit of time.
    
2. FLOPS measures floating-point operations per second.
    
3. CPU throughput depends on frequency, IPC, cores, and workload behavior.
    
4. GPU throughput depends on parallel execution capability and memory performance.
    
5. Memory bandwidth can limit application throughput.
    
6. Arithmetic intensity helps identify compute-bound and memory-bound workloads.
    
7. AI workloads can be evaluated using samples/second and tokens/second.
    
8. CoreWise AI can use throughput to compare processor performance and support recommendations.
    

---

## 17. Related Obsidian Notes

- [Execution-Time](Execution-Time.md.md)
    
- [Speedup](Speedup.md.md)
    
- [Performance-Metrics](Performance-Metrics.md.md)
    
- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Parallel-Processing](../02-COA-Concepts/Parallel-Processing.md.md)
    
- [Memory-Hierarchy](../02-COA-Concepts/Memory-Hierarchy.md.md)
    
- [Amdahls-Law](../02-COA-Concepts/Amdahls-Law.md.md)
    
- [[Benchmarking-Methodology]]
    
- [[ML-Prediction-Model]]
    

---

## Document Status

## **Status:** Initial mathematical documentation  
**Project:** CoreWise AI  
**Category:** Mathematics  
**Next Document:** `Performance-Metrics.md`