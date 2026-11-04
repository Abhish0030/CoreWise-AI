---

title: Execution Time  
project: CoreWise AI  
category: Mathematics  
tags:

- execution-time
    
- CPU
    
- GPU
    
- performance
    
- mathematical-modeling  
    status: Research
    

---

# Execution Time

## 1. Introduction

Execution time is the total time required by a processor to complete a particular computational task or program.

It is one of the most important performance metrics in computer architecture because it indicates how quickly a system can execute a workload.

In CoreWise AI, execution time is used to compare CPU and GPU performance and determine which processor is more suitable for a particular workload.

### Objectives

- Understand execution time mathematically.
    
- Calculate CPU execution time.
    
- Calculate GPU execution time.
    
- Understand data-transfer overhead.
    
- Compare processor performance.
    
- Use execution time as an ML prediction target.
    

---

## 2. Basic Definition

Execution time represents the time interval between the beginning and completion of a computational task.

T=Tfinish−TstartT = T_{finish}-T_{start}

Where:

- TT = Execution time.
    
- TstartT_{start} = Starting timestamp.
    
- TfinishT_{finish} = Completion timestamp.
    

### Example

Suppose a program starts at 10:00:00 and finishes at 10:00:05.

T=10:00:05−10:00:00T=10:00:05-10:00:00 T=5 seconds\boxed{T=5\ seconds}

---

## 3. CPU Execution Time

CPU execution time depends on the number of instructions executed, the average cycles required per instruction, and the processor clock frequency.

The standard formula is:

TCPU=IC×CPIf\boxed{ T_{CPU}=\frac{IC\times CPI}{f} }

Where:

- ICIC = Instruction Count.
    
- CPICPI = Average Cycles Per Instruction.
    
- ff = CPU Clock Frequency.
    

### Explanation

1. Instruction Count represents the total number of executed instructions.
    
2. CPI represents the average clock cycles required per instruction.
    
3. Clock Frequency represents the number of clock cycles per second.
    

### Example

Given:

- Instruction Count = 1,000,000.
    
- CPI = 2.
    
- Clock Frequency = 2 GHz.
    

Substituting:

TCPU=1,000,000×22×109T_{CPU}=\frac{1,000,000\times2}{2\times10^9} =2,000,0002,000,000,000=\frac{2,000,000}{2,000,000,000} TCPU=0.001 seconds\boxed{T_{CPU}=0.001\ seconds}

Therefore:

TCPU=1 ms\boxed{T_{CPU}=1\ ms}

---

## 4. GPU Execution Time

GPU execution time depends on workload size, parallel processing capability, memory access, and kernel execution overhead.

Unlike CPU execution time, GPU execution generally involves additional stages such as memory transfers and kernel launches.

A simplified end-to-end GPU execution model is:

TGPU,total=TH2D+Tlaunch+Tkernel+TD2H+Tsync\boxed{ T_{GPU,total}= T_{H2D}+T_{launch}+T_{kernel}+T_{D2H}+T_{sync} }

Where:

- TH2DT_{H2D} = Host-to-device transfer time.
    
- TlaunchT_{launch} = Kernel launch overhead.
    
- TkernelT_{kernel} = GPU kernel execution time.
    
- TD2HT_{D2H} = Device-to-host transfer time.
    
- TsyncT_{sync} = Additional synchronization overhead.
    

### Example

Suppose:

|Component|Time|
|---|--:|
|Host-to-device transfer|10 ms|
|Kernel launch|2 ms|
|Kernel execution|15 ms|
|Device-to-host transfer|8 ms|
|Additional synchronization|1 ms|

Then:

TGPU,total=10+2+15+8+1T_{GPU,total}=10+2+15+8+1 TGPU,total=36 ms\boxed{T_{GPU,total}=36\ ms}

This is the estimated end-to-end GPU execution time under the simplified sequential timing model.

**Important:** Actual GPU operations may overlap through asynchronous execution and streams. Measurements must account for this to avoid double-counting time.

---

## 5. CPU vs GPU Execution Time

CPU and GPU execution times can be compared using the same workload and equivalent measurement boundaries.

|Parameter|CPU|GPU|
|---|---|---|
|Processing|CPU instructions|GPU kernels|
|Parallelism|Multicore and multithreading|Massive parallel execution|
|Memory|System memory|Device memory or shared system memory|
|Additional Overhead|Scheduling and memory access|Kernel launch and possible data transfer|
|Best-Suited Workloads|Sequential and control-heavy|Highly parallel workloads|

### Example

Suppose the same workload produces:

TCPU=100 msT_{CPU}=100\ ms TGPU=40 msT_{GPU}=40\ ms

The GPU completes the workload faster.

However, the comparison is meaningful only if both measurements include equivalent setup, execution, and data-transfer requirements.

---

## 6. Factors Affecting Execution Time

Execution time depends on several hardware and workload characteristics.

### Hardware Factors

- CPU core count.
    
- CPU clock frequency.
    
- CPU cache size.
    
- GPU processing units.
    
- GPU clock frequency.
    
- Memory bandwidth.
    
- RAM and VRAM capacity.
    

### Workload Factors

- Input size.
    
- Number of operations.
    
- Computational complexity.
    
- Parallelizable fraction.
    
- Memory access patterns.
    
- Data dependencies.
    
- Arithmetic intensity.
    

### Runtime Factors

- Thread scheduling.
    
- Kernel launch overhead.
    
- Synchronization.
    
- Memory transfer.
    
- Background processes.
    
- Thermal throttling.
    

---

## 7. Execution Time and Parallel Processing

Parallel processing can reduce execution time by distributing independent operations across multiple processing units.

A simplified parallel execution-time model is:

Tparallel=(1−P)T+PTNT_{parallel}=(1-P)T+\frac{PT}{N}

Where:

- TT = Original sequential execution time.
    
- PP = Parallelizable fraction.
    
- 1−P1-P = Sequential fraction.
    
- NN = Number of idealized equivalent processing units.
    

### Example

Given:

- Original execution time = 100 seconds.
    
- Parallel fraction = 80%.
    
- Processing units = 4.
    

Tparallel=100(1−0.8)+100(0.8)4T_{parallel}=100(1-0.8)+\frac{100(0.8)}{4} =20+20=20+20 Tparallel=40 seconds\boxed{T_{parallel}=40\ seconds}

This model assumes ideal parallel execution without overhead.

---

## 8. Execution Time Measurement

CoreWise AI should measure execution time using reliable timing mechanisms.

### CPU Measurement

A high-resolution monotonic clock can measure CPU execution time.

Python example:

```python
import time

start = time.perf_counter()

# Execute workload
result = sum(range(1000000))

end = time.perf_counter()

execution_time = end - start

print("CPU Execution Time:", execution_time, "seconds")
```

### GPU Measurement

GPU operations are often asynchronous. Therefore, measuring only the time taken to submit a kernel may not measure its actual execution time.

A correct measurement should synchronize the GPU or use appropriate GPU events.

Conceptual CUDA example:

```cpp
cudaEvent_t start, stop;

cudaEventCreate(&start);
cudaEventCreate(&stop);

cudaEventRecord(start);

// Launch GPU kernel
myKernel<<<grid, block>>>();

cudaEventRecord(stop);
cudaEventSynchronize(stop);

float milliseconds = 0;

cudaEventElapsedTime(&milliseconds, start, stop);
```

This measures the elapsed time between GPU events. It does not automatically include all CPU-side setup or host-device transfer operations.

---

## 9. Statistical Execution Time

A single execution-time measurement may be affected by system conditions.

Therefore, multiple benchmark runs should be performed.

### Average Execution Time

Tavg=∑i=1nTinT_{avg}=\frac{\sum_{i=1}^{n}T_i}{n}

Where:

- TiT_i = Execution time of run ii.
    
- nn = Number of runs.
    

### Example

Suppose five runs produce:

10, 12, 11, 9, 13 ms10,\ 12,\ 11,\ 9,\ 13\ ms Tavg=10+12+11+9+135T_{avg}=\frac{10+12+11+9+13}{5} Tavg=11 ms\boxed{T_{avg}=11\ ms}

### Median Execution Time

The median is the middle value after sorting the measurements.

For the same measurements:

9, 10, 11, 12, 139,\ 10,\ 11,\ 12,\ 13 Tmedian=11 ms\boxed{T_{median}=11\ ms}

Median execution time is useful when occasional unusually slow runs affect the average.

---

## 10. Execution Time in CoreWise AI

Execution time is a primary prediction target for the CoreWise AI machine learning model.

### Proposed Prediction Targets

Y=[TCPU,TGPU,total]Y=[T_{CPU},T_{GPU,total}]

The model can predict:

- CPU execution time.
    
- GPU kernel execution time.
    
- GPU end-to-end execution time.
    

### Proposed Input Features

|Category|Features|
|---|---|
|CPU|Core count, thread count, frequency, cache|
|GPU|SM count, CUDA core count, VRAM, bandwidth|
|Workload|Input size, operation count, parallelism|
|Memory|RAM, VRAM, arithmetic intensity|
|Runtime|Utilization, transfer time, kernel latency|

### Prediction Function

TCPU,pred=f(XCPU,W)T_{CPU,pred}=f(X_{CPU},W) TGPU,pred=g(XGPU,W)T_{GPU,pred}=g(X_{GPU},W)

Where:

- XCPUX_{CPU} = CPU hardware features.
    
- XGPUX_{GPU} = GPU hardware features.
    
- WW = Workload characteristics.
    

---

## 11. CoreWise AI Execution-Time Workflow

```text
        Workload Input
              |
              v
       Workload Analysis
              |
              v
       Hardware Detection
              |
       ------------------
       |                |
       v                v
   CPU Execution    GPU Execution
       |                |
       v                v
   CPU Timing       GPU Timing
       |                |
       ------------------
              |
              v
       Performance Dataset
              |
              v
       ML Prediction Model
              |
              v
       Predicted Execution Time
              |
              v
       CPU vs GPU Comparison
```

---

## 12. Important Considerations

1. Execution time should be measured using a monotonic high-resolution clock.
    
2. GPU measurements should account for asynchronous execution.
    
3. CPU and GPU measurements must use equivalent workload boundaries.
    
4. Data-transfer overhead should be reported separately.
    
5. Multiple benchmark runs improve measurement reliability.
    
6. Background system activity can affect results.
    
7. Hardware temperature and power limits can influence performance.
    
8. Predicted execution time must be distinguished from measured execution time.
    

---

## 13. Key Takeaways

1. Execution time measures how long a workload takes to complete.
    
2. CPU execution time depends on instruction count, CPI, and clock frequency.
    
3. GPU execution time includes kernel execution and potentially data-transfer overhead.
    
4. Parallel processing can reduce execution time.
    
5. Execution-time measurements should be repeated for reliability.
    
6. CPU and GPU comparisons must use consistent measurement boundaries.
    
7. Execution time is a fundamental target variable for CoreWise AI.
    

---

## 14. Related Obsidian Notes

- [Speedup](Speedup.md.md)
    
- [Throughput](Throughput.md.md)
    
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
**Next Document:** `Speedup.md`