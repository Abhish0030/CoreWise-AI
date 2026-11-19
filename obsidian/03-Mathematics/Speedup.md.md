---

title: Speedup  
project: CoreWise AI  
category: Mathematics  
tags:

- speedup
    
- performance
    
- CPU
    
- GPU
    
- parallel-processing
    
- acceleration  
    status: Research
    

---

# Speedup

## 1. Introduction

Speedup is a performance metric that measures how much faster a computational task executes on one system compared with another.

It is commonly used in computer architecture, parallel computing, and performance optimization.

In CoreWise AI, speedup helps compare CPU and GPU execution and quantify the performance improvement achieved by selecting a particular processor.

### Objectives

- Understand the mathematical meaning of speedup.
    
- Calculate CPU-GPU speedup.
    
- Understand parallel speedup.
    
- Calculate parallel efficiency.
    
- Analyze theoretical and actual performance improvements.
    
- Use speedup in CoreWise AI recommendations.
    

---

## 2. Basic Definition

Speedup is the ratio of the execution time of a baseline system to the execution time of an optimized system.

S=TbaselineToptimized\boxed{S=\frac{T_{baseline}}{T_{optimized}}}

Where:

- SS = Speedup.
    
- TbaselineT_{baseline} = Execution time of the original system.
    
- ToptimizedT_{optimized} = Execution time of the improved system.
    

### Interpretation

|Speedup|Meaning|
|---|---|
|S>1S>1|Optimized system is faster|
|S=1S=1|Both systems have equal execution time|
|S<1S<1|Optimized system is slower|

---

## 3. CPU vs GPU Speedup

CoreWise AI uses speedup to compare CPU and GPU performance for the same workload.

The formula is:

SGPU=TCPUTGPU\boxed{ S_{GPU}=\frac{T_{CPU}}{T_{GPU}} }

Where:

- TCPUT_{CPU} = CPU execution time.
    
- TGPUT_{GPU} = GPU execution time.
    

For a fair comparison, GPU execution time should include the relevant data-transfer and execution overhead.

### Example

Suppose a workload produces the following results:

- CPU execution time = 100 ms.
    
- GPU execution time = 25 ms.
    

Substituting:

SGPU=10025S_{GPU}=\frac{100}{25} SGPU=4\boxed{S_{GPU}=4}

### Final Result

The GPU executes the workload four times faster than the CPU.

---

## 4. Step-by-Step Numerical Problem

### Question

A computational workload takes 12 seconds on a CPU and 3 seconds on a GPU.

Calculate the speedup achieved by using the GPU.

### Given

TCPU=12 secondsT_{CPU}=12\ seconds TGPU=3 secondsT_{GPU}=3\ seconds

### Formula

S=TCPUTGPUS=\frac{T_{CPU}}{T_{GPU}}

### Step 1: Substitute the values

S=123S=\frac{12}{3}

### Step 2: Calculate

S=4\boxed{S=4}

### Final Answer

The GPU provides a speedup of **4 times** compared with the CPU.

---

## 5. Parallel Speedup

Parallel speedup measures the improvement obtained by executing a workload using multiple processing units instead of one processing unit.

S(N)=T1TN\boxed{ S(N)=\frac{T_1}{T_N} }

Where:

- T1T_1 = Execution time using one processing unit.
    
- TNT_N = Execution time using NN processing units.
    
- NN = Number of processing units.
    

### Example

Suppose:

- Single-core execution time = 40 seconds.
    
- Four-core execution time = 10 seconds.
    

S(4)=4010S(4)=\frac{40}{10} S(4)=4\boxed{S(4)=4}

The four-core implementation achieves a speedup of four times.

This is called ideal linear speedup.

---

## 6. Ideal Speedup

Ideal speedup occurs when adding processing units reduces execution time proportionally.

Sideal=N\boxed{S_{ideal}=N}

Where NN is the number of processing units.

### Example

If a workload executes on eight processing units:

Sideal=8S_{ideal}=8

The ideal speedup is eight times.

However, actual systems may achieve lower speedup because of:

- Sequential operations.
    
- Communication overhead.
    
- Synchronization.
    
- Memory bottlenecks.
    
- Unequal workload distribution.
    
- Hardware resource limitations.
    

---

## 7. Superlinear Speedup

Superlinear speedup occurs when the observed speedup is greater than the number of processing units.

S(N)>NS(N)>N

### Example

Suppose:

- Number of processing units = 4.
    
- Single-unit execution time = 100 seconds.
    
- Four-unit execution time = 20 seconds.
    

S(4)=10020S(4)=\frac{100}{20} S(4)=5S(4)=5

Since:

5>45>4

The observed speedup is superlinear.

### Possible Reasons

- Better cache utilization.
    
- Reduced memory access time.
    
- Changes in memory behavior.
    
- Algorithmic or measurement differences.
    

Superlinear speedup is not the normal expectation and should be investigated carefully.

---

## 8. Sublinear Speedup

Sublinear speedup occurs when the speedup is greater than one but smaller than the number of processing units.

1<S(N)<N1<S(N)<N

### Example

Suppose:

- Number of processing units = 8.
    
- Single-unit execution time = 80 seconds.
    
- Eight-unit execution time = 20 seconds.
    

S(8)=8020S(8)=\frac{80}{20} S(8)=4S(8)=4

Since:

1<4<81<4<8

The system achieves sublinear speedup.

This is common in real parallel computing because additional processing resources introduce overhead and resource contention.

---

## 9. Parallel Efficiency

Parallel efficiency measures how effectively the available processing units contribute to performance improvement.

E=S(N)N×100\boxed{ E=\frac{S(N)}{N}\times100 }

Where:

- EE = Parallel efficiency.
    
- S(N)S(N) = Observed speedup.
    
- NN = Number of processing units.
    

### Example

Suppose:

- Number of processing units = 8.
    
- Observed speedup = 4.
    

E=48×100E=\frac{4}{8}\times100 E=50%\boxed{E=50\%}

The parallel implementation achieves 50% efficiency relative to ideal linear speedup.

---

## 10. Speedup Using Amdahl's Law

Amdahl's Law estimates theoretical speedup based on the parallelizable fraction of a workload.

S(N)=1(1−P)+PN\boxed{ S(N)=\frac{1}{(1-P)+\frac{P}{N}} }

Where:

- PP = Parallelizable fraction.
    
- 1−P1-P = Sequential fraction.
    
- NN = Number of processing units.
    

### Example

Given:

- Parallel fraction = 90%.
    
- Sequential fraction = 10%.
    
- Processing units = 8.
    

P=0.9P=0.9 N=8N=8

Substitute:

S(8)=1(1−0.9)+0.98S(8)=\frac{1}{(1-0.9)+\frac{0.9}{8}} S(8)=10.1+0.1125S(8)=\frac{1}{0.1+0.1125} S(8)=10.2125S(8)=\frac{1}{0.2125} S(8)≈4.71\boxed{S(8)\approx4.71}

The theoretical speedup is approximately 4.71 times.

For further mathematical explanation, refer to:

[Amdahls-Law](../02-COA-Concepts/Amdahls-Law.md.md)

---

## 11. Percentage Performance Improvement

Speedup measures the execution-time ratio. Percentage reduction in execution time measures how much of the original execution time has been saved.

The formula is:

Improvement(%)=Tbaseline−ToptimizedTbaseline×100\boxed{ Improvement(\%)= \frac{T_{baseline}-T_{optimized}} {T_{baseline}}\times100 }

### Example

Suppose:

- CPU execution time = 100 ms.
    
- GPU execution time = 25 ms.
    

Improvement=100−25100×100Improvement= \frac{100-25}{100}\times100 =75100×100=\frac{75}{100}\times100 Improvement=75%\boxed{Improvement=75\%}

The GPU reduces execution time by 75%.

**Important:** A 4× speedup corresponds to a 75% reduction in execution time, not a 400% reduction.

---

## 12. Actual Speedup vs Theoretical Speedup

Theoretical speedup assumes ideal execution conditions.

Actual speedup is calculated using measured benchmark execution times.

|Parameter|Theoretical Speedup|Actual Speedup|
|---|---|---|
|Basis|Mathematical assumptions|Benchmark measurements|
|Overhead|Often excluded|Included according to measurement boundaries|
|Memory Limitations|Usually simplified|Affect real performance|
|Synchronization|Often ignored|Can affect execution|
|Accuracy|Predictive estimate|Observed performance|

### Example

Theoretical prediction:

Stheoretical=8S_{theoretical}=8

Measured execution:

TCPU=100 msT_{CPU}=100\ ms TGPU=20 msT_{GPU}=20\ ms

Actual speedup:

Sactual=10020=5S_{actual}=\frac{100}{20}=5

The actual speedup is five times, whereas the theoretical estimate is eight times.

The difference may result from transfer overhead, memory limitations, synchronization, or other execution costs.

---

## 13. Speedup in CoreWise AI

CoreWise AI can use speedup as an important metric in processor recommendation.

The system predicts CPU and GPU execution times and calculates the expected performance improvement.

### Step 1: Workload Input

The user submits a computational workload.

### Step 2: Hardware Detection

Collect CPU and GPU specifications.

### Step 3: Performance Prediction

The ML model predicts:

TCPU,predT_{CPU,pred} TGPU,predT_{GPU,pred}

### Step 4: Speedup Calculation

Spred=TCPU,predTGPU,predS_{pred}= \frac{T_{CPU,pred}}{T_{GPU,pred}}

### Step 5: Performance Interpretation

- If Spred>1S_{pred}>1, GPU is predicted to be faster.
    
- If Spred<1S_{pred}<1, CPU is predicted to be faster.
    
- If Spred=1S_{pred}=1, predicted execution times are equal.
    

### Step 6: Recommendation

The recommendation engine considers speedup alongside memory requirements, prediction uncertainty, and hardware compatibility.

---

## 14. Proposed CoreWise AI Speedup Pipeline

```text
         Workload Input
               |
               v
       Hardware Detection
               |
               v
       ML Prediction Model
               |
        -----------------
        |               |
        v               v
   CPU Prediction   GPU Prediction
        |               |
        -----------------
               |
               v
        Speedup Calculation
               |
               v
       Performance Analysis
               |
               v
      Processor Recommendation
               |
               v
       Agentic AI Explanation
```

---

## 15. Python Implementation

The following Python program calculates speedup, efficiency, and percentage improvement.

```python
def calculate_performance(cpu_time, gpu_time, processing_units):
    if cpu_time <= 0 or gpu_time <= 0:
        raise ValueError("Execution times must be positive.")

    if processing_units <= 0:
        raise ValueError("Processing units must be positive.")

    speedup = cpu_time / gpu_time

    efficiency = (speedup / processing_units) * 100

    improvement = (
        (cpu_time - gpu_time) / cpu_time
    ) * 100

    print("CPU Execution Time:", cpu_time)
    print("GPU Execution Time:", gpu_time)
    print("Speedup:", round(speedup, 2), "x")
    print("Parallel Efficiency:", round(efficiency, 2), "%")
    print("Execution Time Reduction:", round(improvement, 2), "%")

    if speedup > 1:
        print("Recommendation: GPU is faster.")
    elif speedup < 1:
        print("Recommendation: CPU is faster.")
    else:
        print("Recommendation: Both have equal execution time.")


calculate_performance(
    cpu_time=100,
    gpu_time=25,
    processing_units=8
)
```

**Note:** The efficiency calculation is meaningful only when `processing_units` represents the actual number of comparable parallel processing units for the experiment. CPU cores and GPU CUDA cores should not be treated as directly equivalent.

---

## 16. Important Considerations for CoreWise AI

1. Speedup must use the same workload on both processors.
    
2. CPU and GPU execution boundaries must be consistent.
    
3. GPU transfer overhead should be considered.
    
4. Theoretical speedup must not be confused with measured speedup.
    
5. Benchmark results should be repeated.
    
6. Speedup below one indicates a performance slowdown relative to the baseline.
    
7. CPU cores and GPU execution units are architecturally different.
    
8. Prediction uncertainty should be considered before making recommendations.
    
9. Performance improvement should be calculated from execution times, not hardware specifications alone.
    

---

## 17. Key Takeaways

1. Speedup measures how much faster an optimized system executes a workload.
    
2. CPU-GPU speedup is calculated using CPU execution time divided by GPU execution time.
    
3. Ideal linear speedup equals the number of processing units.
    
4. Parallel efficiency measures the effectiveness of parallel resources.
    
5. Superlinear speedup is greater than the number of processing units.
    
6. Sublinear speedup is common in practical parallel computing.
    
7. Amdahl's Law estimates theoretical speedup.
    
8. Percentage improvement measures execution-time reduction.
    
9. Actual speedup requires benchmark measurements.
    
10. CoreWise AI can use predicted speedup to support processor recommendations.
    

---

## 18. Related Obsidian Notes

- [Execution-Time](Execution-Time.md.md)
    
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
**Next Document:** `Throughput.md`