---

title: Amdahl's Law  
project: CoreWise AI  
category: COA Concepts  
tags:

- amdahls-law
    
- parallel-processing
    
- speedup
    
- CPU
    
- GPU
    
- performance-analysis
    
- mathematics  
    status: Research
    

---

# Amdahl's Law

## 1. Introduction

Amdahl's Law is a principle in computer architecture and parallel computing that describes the maximum theoretical speedup achievable when only a portion of a program can be parallelized.

It explains that the sequential portion of a program limits the performance improvement obtained by adding more processing resources.

Even if a system has many CPU cores or a powerful GPU, the total execution time cannot be reduced indefinitely when some operations must execute sequentially.

### Why Amdahl's Law Is Important

Amdahl's Law helps us understand:

- The limitations of parallel processing.
    
- The maximum possible speedup.
    
- The impact of sequential operations.
    
- The relationship between processing resources and execution time.
    
- Whether a workload can benefit from additional CPU cores or GPU acceleration.
    

**CoreWise AI perspective:** Amdahl's Law can help estimate the theoretical benefit of parallel execution before recommending CPU or GPU processing.

---

## 2. Basic Concept

A program can be divided into two parts:

1. Sequential portion: Operations that must execute one after another.
    
2. Parallel portion: Operations that can execute simultaneously.
    

Let:

- PP = Parallelizable fraction of the program.
    
- 1−P1-P = Sequential fraction of the program.
    
- NN = Number of processing units.
    

The total execution time depends on both portions.

### Example

Suppose a program takes 100 seconds to execute.

Its execution is divided as follows:

|Portion|Percentage|Execution Time|
|---|--:|--:|
|Sequential|20%|20 seconds|
|Parallel|80%|80 seconds|
|Total|100%|100 seconds|

Even if the parallel portion executes instantly, the sequential portion still requires 20 seconds.

Therefore, the maximum possible speedup is limited.

---

## 3. Mathematical Formula

Amdahl's Law is expressed as:

S(N)=1(1−P)+PN\boxed{S(N)=\frac{1}{(1-P)+\frac{P}{N}}}

Where:

- S(N)S(N) = Theoretical speedup using NN processing units.
    
- PP = Fraction of the workload that can be parallelized.
    
- 1−P1-P = Sequential fraction.
    
- NN = Number of processing units.
    

### Explanation

The formula consists of two components:

Tparallel=(1−P)+PNT_{parallel}=(1-P)+\frac{P}{N}

Here, the original execution time is normalized to 1.

The sequential portion remains unchanged, while the parallel portion is divided among NN processing units under ideal assumptions.

Therefore:

Speedup=Original Execution TimeParallel Execution TimeSpeedup=\frac{Original\ Execution\ Time} {Parallel\ Execution\ Time}

Since the normalized original execution time is 1:

S(N)=1(1−P)+PNS(N)=\frac{1}{(1-P)+\frac{P}{N}}

---

## 4. Step-by-Step Numerical Example

### Question

A program has 80% parallelizable operations and 20% sequential operations.

Calculate the theoretical speedup when four processing units are used.

### Given

P=80%=0.8P=80\%=0.8 1−P=0.21-P=0.2 N=4N=4

### Formula

S(N)=1(1−P)+PNS(N)=\frac{1}{(1-P)+\frac{P}{N}}

### Step 1: Substitute the values

S(4)=1(1−0.8)+0.84S(4)=\frac{1}{(1-0.8)+\frac{0.8}{4}}

### Step 2: Simplify

S(4)=10.2+0.2S(4)=\frac{1}{0.2+0.2}

### Step 3: Calculate

S(4)=10.4S(4)=\frac{1}{0.4} S(4)=2.5\boxed{S(4)=2.5}

### Final Answer

The theoretical speedup using four processing units is **2.5 times**.

---

## 5. Execution Time Calculation

Amdahl's Law can also be used to calculate the expected execution time.

Suppose:

- Original execution time = 100 seconds.
    
- Parallelizable fraction = 80%.
    
- Number of processing units = 4.
    

Sequential execution time:

Ts=100×0.2=20 secondsT_s=100\times0.2=20\ seconds

Parallel portion:

Tp=100×0.8=80 secondsT_p=100\times0.8=80\ seconds

After distributing the parallel portion across four processing units:

Tparallel=804=20 secondsT_{parallel}=\frac{80}{4}=20\ seconds

Total execution time:

Tnew=20+20T_{new}=20+20 Tnew=40 seconds\boxed{T_{new}=40\ seconds}

Speedup:

S=10040=2.5S=\frac{100}{40}=2.5

The result matches the previous calculation.

---

## 6. Effect of Increasing Processing Units

Consider a program with 80% parallelizable operations.

We calculate speedup for different numbers of processing units.

S(N)=10.2+0.8NS(N)=\frac{1}{0.2+\frac{0.8}{N}}

|Processing Units (N)|Theoretical Speedup|
|--:|--:|
|1|1.00×|
|2|1.67×|
|4|2.50×|
|8|3.33×|
|16|4.00×|
|32|4.44×|
|64|4.71×|

### Observation

As the number of processing units increases, speedup improves.

However, the improvement becomes progressively smaller because the sequential portion remains unchanged.

This demonstrates the limitation of parallel processing.

---

## 7. Maximum Theoretical Speedup

An important concept in Amdahl's Law is the maximum possible speedup.

When the number of processing units approaches infinity:

N→∞N\rightarrow\infty

The parallel portion becomes:

PN→0\frac{P}{N}\rightarrow0

Therefore:

Smax=11−PS_{max}=\frac{1}{1-P}

### Example

If 80% of the program is parallelizable:

P=0.8P=0.8 Smax=11−0.8S_{max}=\frac{1}{1-0.8} Smax=10.2S_{max}=\frac{1}{0.2} Smax=5\boxed{S_{max}=5}

Even with an unlimited number of ideal processing units, the maximum theoretical speedup is five times.

This is because 20% of the program must execute sequentially.

---

## 8. Relationship Between Parallel Fraction and Speedup

The parallelizable fraction strongly influences the achievable speedup.

Consider the following examples with an unlimited number of processing units.

|Parallelizable Fraction|Sequential Fraction|Maximum Speedup|
|--:|--:|--:|
|50%|50%|2×|
|70%|30%|3.33×|
|80%|20%|5×|
|90%|10%|10×|
|95%|5%|20×|
|99%|1%|100×|

### Important Observation

A small sequential portion can significantly restrict overall performance.

Therefore, improving parallelism and reducing sequential operations can be more beneficial than simply adding more processing resources.

---

## 9. Amdahl's Law in CPU Performance

Modern CPUs support parallel execution through:

- Multiple physical cores.
    
- Hardware threads.
    
- Instruction-level parallelism.
    
- Multithreaded applications.
    

However, not every program can use all available CPU cores efficiently.

### Example

Suppose a program contains:

- 70% parallelizable operations.
    
- 30% sequential operations.
    

Using eight CPU cores:

S(8)=10.3+0.78S(8)=\frac{1}{0.3+\frac{0.7}{8}} S(8)=10.3+0.0875S(8)=\frac{1}{0.3+0.0875} S(8)=10.3875S(8)=\frac{1}{0.3875} S(8)≈2.58\boxed{S(8)\approx2.58}

Although eight CPU cores are available, the theoretical speedup is only approximately 2.58 times.

---

## 10. Amdahl's Law in GPU Performance

GPUs contain many parallel processing resources, but their performance also depends on the amount of parallelizable work.

A GPU may not provide significant speedup when:

- The workload is small.
    
- Most operations are sequential.
    
- The workload contains many dependencies.
    
- Kernel launch overhead is high.
    
- CPU-GPU data transfer takes significant time.
    

### Example

Suppose:

- Sequential fraction = 10%.
    
- Parallel fraction = 90%.
    
- Idealized number of parallel processing units = 100.
    

P=0.9P=0.9 N=100N=100

Substitute:

S(100)=10.1+0.9100S(100)=\frac{1}{0.1+\frac{0.9}{100}} S(100)=10.1+0.009S(100)=\frac{1}{0.1+0.009} S(100)=10.109S(100)=\frac{1}{0.109} S(100)≈9.17\boxed{S(100)\approx9.17}

The theoretical speedup is approximately 9.17 times.

**Important:** The value N=100N=100 represents an idealized number of equivalent parallel processing units for mathematical analysis. It does not mean a real GPU with 100 CUDA cores will achieve this speedup.

---

## 11. Limitations of Amdahl's Law

Amdahl's Law is based on simplified assumptions.

Its limitations include:

### 11.1 Fixed Workload Size

It assumes that the total problem size remains constant while the number of processing units increases.

### 11.2 Ideal Parallel Execution

It assumes that the parallel portion is distributed perfectly across processing units.

### 11.3 No Communication Overhead

The basic formula does not account for communication between processing units.

### 11.4 No Synchronization Overhead

Real parallel applications may require synchronization between threads.

### 11.5 No Memory Bottlenecks

The basic formula does not include memory latency, bandwidth limitations, or cache misses.

### 11.6 No Resource Contention

It assumes that processing units do not compete for shared resources.

### 11.7 Fixed Parallelizable Fraction

It assumes that the parallelizable fraction does not change as the number of processing units increases.

**Conclusion:** Amdahl's Law provides a theoretical speedup estimate, not a guarantee of real-world performance.

---

## 12. Amdahl's Law vs Real-World Performance

Actual parallel execution includes additional overhead.

A more realistic conceptual execution-time model is:

Tactual=Tsequential+Tparallel+ToverheadT_{actual}=T_{sequential}+T_{parallel}+T_{overhead}

Where overhead may include:

- Thread creation.
    
- Task scheduling.
    
- Synchronization.
    
- Communication.
    
- Memory access.
    
- Data transfer.
    
- Kernel launch.
    

For CPU-GPU execution, total GPU time may be represented as:

TGPU,total=TH2D+Tlaunch+Tkernel+TD2H+TsyncT_{GPU,total}= T_{H2D}+T_{launch}+T_{kernel}+T_{D2H}+T_{sync}

Where:

- TH2DT_{H2D} = Host-to-device transfer time.
    
- TlaunchT_{launch} = Kernel launch overhead.
    
- TkernelT_{kernel} = Kernel execution time.
    
- TD2HT_{D2H} = Device-to-host transfer time.
    
- TsyncT_{sync} = Synchronization overhead not already included in the other measurements.
    

The exact measurement method must avoid double-counting overlapping operations.

This explains why theoretical speedup and actual benchmark speedup may differ.

---

## 13. Gustafson's Law

Gustafson's Law provides another perspective on parallel computing.

Unlike Amdahl's Law, which assumes a fixed problem size, Gustafson's Law considers increasing the problem size as more processing resources become available.

Its formula is:

S(N)=N−α(N−1)S(N)=N-\alpha(N-1)

Where:

- NN = Number of processing units.
    
- α\alpha = Sequential fraction of execution time.
    

### Example

Suppose:

- Number of processing units = 8.
    
- Sequential fraction = 0.1.
    

S(8)=8−0.1(8−1)S(8)=8-0.1(8-1) S(8)=8−0.7S(8)=8-0.7 S(8)=7.3\boxed{S(8)=7.3}

The scaled speedup is 7.3 times.

### Amdahl's Law vs Gustafson's Law

|Parameter|Amdahl's Law|Gustafson's Law|
|---|---|---|
|Problem Size|Fixed|Scales with resources|
|Main Focus|Maximum speedup for fixed work|Speedup for larger workloads|
|Application|Fixed-size performance analysis|Scalable parallel computing|
|Key Limitation|Sequential fraction|Sequential fraction still matters|

Both laws are useful for understanding parallel performance under different workload assumptions.

---

## 14. Application in CoreWise AI

Amdahl's Law can be used as a theoretical feature in CoreWise AI's processor recommendation system.

The system can analyze a workload's parallelizable and sequential portions before estimating its performance.

### Proposed Workflow

**Step 1: Workload Input**

The user provides a workload or benchmark configuration.

**Step 2: Workload Analysis**

Identify:

- Total operations.
    
- Sequential operations.
    
- Parallel operations.
    
- Task dependencies.
    
- Data size.
    

**Step 3: Parallel Fraction Estimation**

Estimate the parallelizable fraction:

P=TparallelizableTtotalP=\frac{T_{parallelizable}}{T_{total}}

This estimation requires profiling, algorithm analysis, or benchmark measurements. It should not be assumed from input size alone.

**Step 4: Theoretical Speedup Calculation**

Use Amdahl's Law:

S(N)=1(1−P)+PNS(N)=\frac{1}{(1-P)+\frac{P}{N}}

**Step 5: Hardware Analysis**

Collect CPU and GPU specifications.

**Step 6: Machine Learning Prediction**

Use benchmark data and workload features to predict actual execution time.

**Step 7: Processor Recommendation**

Compare predicted CPU and GPU execution times.

**Step 8: Agentic AI Explanation**

Explain the recommendation using parallelism, execution time, and hardware characteristics.

### Proposed Architecture

```text
          Workload Input
                |
                v
        Workload Analysis
                |
                v
       Parallelism Estimation
                |
                v
         Calculate P and N
                |
                v
          Amdahl's Law
                |
                v
       Theoretical Speedup
                |
                v
        Hardware Analysis
                |
                v
       ML Performance Model
                |
                v
        CPU vs GPU Comparison
                |
                v
       Agentic AI Explanation
```

---

## 15. Proposed Mathematical Features for CoreWise AI

Amdahl's Law can help derive additional workload features.

|Feature|Mathematical Expression|Purpose|
|---|---|---|
|Parallel Fraction|P=Tp/TtotalP=T_p/T_{total}|Estimate parallelizable work|
|Sequential Fraction|1−P1-P|Estimate sequential work|
|Theoretical Speedup|1/((1−P)+P/N)1/((1-P)+P/N)|Estimate ideal speedup|
|Maximum Speedup|1/(1−P)1/(1-P)|Calculate theoretical limit|
|Parallel Efficiency|S(N)/N×100S(N)/N \times 100|Measure resource efficiency|

Where TpT_p represents the time associated with the parallelizable portion under the original sequential baseline.

These values can support workload analysis, but the ML model should still learn from measured CPU and GPU execution times.

---

## 16. Practical Experiments

### Experiment 1: Calculate Theoretical Speedup

**Objective:** Understand how parallel fraction affects speedup.

Test:

- 50% parallel fraction.
    
- 70% parallel fraction.
    
- 80% parallel fraction.
    
- 90% parallel fraction.
    

Calculate speedup for 2, 4, 8, and 16 processing units.

### Experiment 2: CPU Multicore Benchmark

**Objective:** Compare theoretical and actual speedup.

Execute the same workload using different CPU thread counts.

Record:

- Number of threads.
    
- Execution time.
    
- Speedup.
    
- Parallel efficiency.
    

### Experiment 3: CPU vs GPU Benchmark

**Objective:** Compare real-world performance with theoretical expectations.

Execute a parallelizable workload on CPU and GPU.

Record:

- CPU execution time.
    
- GPU kernel time.
    
- GPU transfer time.
    
- Total GPU execution time.
    
- Actual speedup.
    

### Experiment 4: Sequential Workload Analysis

**Objective:** Identify workloads that cannot benefit significantly from parallel execution.

Use a workload with dependent operations.

Measure its performance using different numbers of CPU threads.

Observe whether adding more threads improves execution time.

---

## 17. Key Takeaways

1. Amdahl's Law explains the theoretical limits of parallel speedup.
    
2. A program contains sequential and parallelizable portions.
    
3. The sequential fraction limits maximum performance improvement.
    
4. Adding more processing units does not guarantee proportional speedup.
    
5. Maximum speedup is determined by 1/(1−P)1/(1-P).
    
6. Amdahl's Law applies to both CPU and GPU parallel execution.
    
7. Real-world performance is affected by synchronization, communication, memory, and data-transfer overhead.
    
8. Gustafson's Law considers performance when problem size increases with processing resources.
    
9. CoreWise AI can use parallelism analysis to estimate theoretical performance limits.
    
10. Actual benchmark measurements are necessary to validate processor recommendations.
    

---

## 18. Related Obsidian Notes

- [CPU-Architecture](CPU-Architecture.md.md)
    
- [GPU-Architecture](GPU-Architecture.md.md)
    
- [Parallel-Processing](Parallel-Processing.md.md)
    
- [Memory-Hierarchy](Memory-Hierarchy.md.md)
    
- [[Research-Papers]]
    
- [Literature-Review](../01-Research/Research-Papers/Literature-Review.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    
- [[Benchmarking-Methodology]]
    

---

## Document Status

## **Status:** Initial research documentation  
**Project:** CoreWise AI  
**Category:** Computer Organization and Architecture  
**Next Section:** Research and system-design documentation