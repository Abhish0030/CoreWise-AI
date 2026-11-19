---

title: GPU Architecture  
project: CoreWise AI  
category: COA Concepts  
tags:

- GPU
    
- architecture
    
- CUDA
    
- parallel-processing
    
- performance-analysis  
    status: Research
    

---

# GPU Architecture

## 1. Introduction

A Graphics Processing Unit (GPU) is a specialized processor designed to execute a large number of operations simultaneously. GPUs are particularly effective for workloads that contain many independent calculations, such as image processing, scientific simulations, matrix multiplication, and Artificial Intelligence (AI).

Unlike a CPU, which is designed to handle a wide variety of tasks with strong individual-thread performance, a GPU focuses on executing thousands of lightweight threads concurrently.

### Why GPUs Are Important

GPUs are widely used in:

- Deep learning and neural networks.
    
- Image and video processing.
    
- Scientific computing.
    
- Large-scale matrix operations.
    
- Parallel data processing.
    
- Machine learning inference and training.
    

**CoreWise AI perspective:** Understanding GPU architecture helps determine whether a workload can benefit from GPU execution or whether CPU execution may be more efficient.

---

## 2. Basic GPU Architecture

A GPU consists of multiple processing units that execute parallel instructions.

The major architectural components include:

1. Streaming Multiprocessors (SMs).
    
2. CUDA Cores.
    
3. Warp Schedulers.
    
4. Registers.
    
5. Shared Memory.
    
6. Cache Memory.
    
7. Global Memory.
    
8. Memory Controllers.
    

### Simplified GPU Architecture

```text
                 GPU
                  |
       -----------------------
       |          |          |
      SM 1       SM 2       SM 3
       |          |          |
    --------   --------   --------
    | Cores|   | Cores|   | Cores|
    | Warp |   | Warp |   | Warp |
    | Regs |   | Regs |   | Regs |
    |Shared|   |Shared|   |Shared|
    --------   --------   --------
       |          |          |
       -----------------------
                  |
              L2 Cache
                  |
             Global Memory
                  |
               DRAM
```

_Note: This is a conceptual diagram. Actual GPU architectures contain different numbers and arrangements of processing units and memory resources._

---

## 3. Streaming Multiprocessor (SM)

A Streaming Multiprocessor (SM) is a major processing unit in NVIDIA GPU architecture.

An SM contains resources that allow multiple GPU threads to execute concurrently.

Its components typically include:

- CUDA cores.
    
- Warp schedulers.
    
- Register files.
    
- Shared memory.
    
- Load/store units.
    
- Special function units.
    

### Working Principle

1. The CPU launches a GPU kernel.
    
2. The GPU divides the workload into thread blocks.
    
3. Thread blocks are assigned to available SMs.
    
4. Each SM executes the threads belonging to its assigned blocks.
    
5. Warp schedulers select eligible warps for execution.
    
6. Results are written to the appropriate memory locations.
    

A GPU with more SMs may be capable of processing more thread blocks concurrently, depending on workload characteristics and available resources.

**CoreWise AI feature:**

- Number of SMs.
    
- SM utilization.
    
- Number of active thread blocks.
    
- GPU compute capability.
    

These features can help estimate the available parallel processing capacity.

---

## 4. CUDA Cores

CUDA cores are arithmetic processing units within NVIDIA SMs.

They execute individual arithmetic and logical operations required by GPU threads.

Examples include:

- Addition.
    
- Subtraction.
    
- Multiplication.
    
- Floating-point operations.
    
- Integer operations.
    

### Important Concept

CUDA cores are not equivalent to CPU cores.

A CPU core is a relatively complex processing unit designed to execute general-purpose instructions. CUDA cores are smaller execution units organized within SMs.

A GPU may contain thousands of CUDA cores, but the actual performance depends on factors such as:

- Clock frequency.
    
- Memory bandwidth.
    
- Instruction type.
    
- Number of active threads.
    
- Register availability.
    
- Workload parallelism.
    

**CoreWise AI feature:**

- CUDA core count.
    
- GPU clock frequency.
    
- Compute capability.
    
- Theoretical processing capability.
    

---

## 5. GPU Thread Hierarchy

CUDA organizes GPU execution through three main levels:

1. Grid.
    
2. Thread Block.
    
3. Thread.
    

### 5.1 Thread

A thread is the smallest execution unit in the CUDA programming model.

Each thread executes the kernel instructions independently using its own thread identifier.

### 5.2 Thread Block

A thread block is a group of threads that can cooperate with each other.

Threads within the same block can:

- Share data through shared memory.
    
- Synchronize using block-level synchronization.
    
- Cooperate to solve a larger computational problem.
    

A block is assigned to one SM during its execution.

### 5.3 Grid

A grid represents the complete collection of thread blocks launched for a kernel.

### Execution Hierarchy Diagram

```text
                  GRID
                    |
       ---------------------------
       |            |            |
    Block 1      Block 2      Block 3
       |            |            |
    --------     --------     --------
    |  T1  |     |  T1  |     |  T1  |
    |  T2  |     |  T2  |     |  T2  |
    |  T3  |     |  T3  |     |  T3  |
    |  T4  |     |  T4  |     |  T4  |
    --------     --------     --------
```

### Example

Suppose a GPU kernel processes 1,024 independent data elements.

If each thread processes one element:

- Total elements = 1,024.
    
- Threads per block = 256.
    
- Number of blocks = 4.
    

Therefore:

Number of Blocks=Total ThreadsThreads per Block\text{Number of Blocks} = \frac{\text{Total Threads}}{\text{Threads per Block}} =1024256=4= \frac{1024}{256} = 4

This creates one grid containing four thread blocks.

**CoreWise AI feature:**

- Grid dimensions.
    
- Block dimensions.
    
- Total thread count.
    
- Threads per block.
    
- Workload size.
    

---

## 6. Warp Execution

A warp is a group of threads scheduled together by an NVIDIA GPU.

In the standard NVIDIA CUDA programming model, a warp contains 32 threads.

### Working Principle

- Threads within a warp execute instructions in a coordinated SIMT execution model.
    
- A warp scheduler selects eligible warps.
    
- Multiple warps can be active on an SM.
    
- Switching between eligible warps helps hide execution and memory latency.
    

### SIMT: Single Instruction, Multiple Threads

SIMT allows multiple threads to execute the same instruction on different data.

For example, consider adding two arrays:

C[i]=A[i]+B[i]C[i] = A[i] + B[i]

Different threads can calculate different array elements concurrently.

### Warp Divergence

Warp divergence occurs when threads in the same warp follow different execution paths because of conditional statements.

Example:

```c
if (thread_id % 2 == 0) {
    result = a + b;
} else {
    result = a * b;
}
```

When threads take different branches, the GPU may need to execute the different paths separately for the affected threads.

This can reduce execution efficiency.

**CoreWise AI feature:**

- Warp execution efficiency.
    
- Branch divergence indicators.
    
- Active warps.
    
- Instructions per warp.
    

---

## 7. GPU Memory Architecture

GPU memory architecture affects how quickly data reaches processing units.

Important memory types include:

|Memory Type|Description|
|---|---|
|Registers|Fast, thread-local storage|
|Shared Memory|Fast memory shared by threads within a block|
|L1 Cache|Cache associated with an SM|
|L2 Cache|Cache shared across GPU processing units|
|Global Memory|Main GPU device memory|
|Constant Memory|Read-only memory space optimized for certain access patterns|
|Texture Memory|Read-only cached memory space used for specific access patterns|

### Why Memory Matters

A GPU may have high computational capability, but performance can remain low if data cannot be supplied to processing units quickly enough.

For example:

- Repeatedly accessing global memory can increase memory latency.
    
- Poor memory access patterns can reduce memory efficiency.
    
- Insufficient shared memory can limit the number of simultaneously resident blocks.
    
- Limited registers can restrict the number of active warps.
    

Detailed memory organization and memory performance will be discussed in:

[Memory-Hierarchy](Memory-Hierarchy.md.md)

---

## 8. GPU Occupancy

Occupancy measures how many warps are active on an SM compared with the maximum number of warps that the SM can support.

Occupancy=Active WarpsMaximum Supported Warps×100\text{Occupancy} = \frac{\text{Active Warps}} {\text{Maximum Supported Warps}} \times 100

### Example

Suppose an SM supports a maximum of 64 active warps.

If 32 warps are active:

Occupancy=3264×100\text{Occupancy} = \frac{32}{64} \times 100 =50%= 50\%

Therefore, GPU occupancy is 50%.

### Factors Affecting Occupancy

- Registers required per thread.
    
- Shared memory required per block.
    
- Threads per block.
    
- Maximum resident blocks per SM.
    
- Hardware resource limits.
    

### Important Difference

Occupancy is not the same as GPU utilization.

- **Occupancy:** Measures active warps relative to the hardware limit.
    
- **GPU utilization:** Indicates how busy the GPU is over a measurement period.
    

Higher occupancy does not automatically guarantee better performance. A workload may achieve good performance at moderate occupancy if it efficiently uses available resources.

**CoreWise AI feature:**

- Occupancy percentage.
    
- Active warps.
    
- Registers per thread.
    
- Shared memory per block.
    
- Threads per block.
    

---

## 9. GPU Execution Workflow

GPU applications commonly follow a host-device execution model.

The CPU acts as the host, while the GPU acts as the device.

### Execution Steps

1. The CPU prepares input data.
    
2. Input data is transferred to GPU memory when required.
    
3. The CPU launches a GPU kernel.
    
4. The GPU schedules thread blocks on available SMs.
    
5. GPU threads execute parallel operations.
    
6. Results are stored in GPU memory.
    
7. Results are transferred back to CPU memory when required.
    
8. The CPU consumes the results.
    

### Execution Flow Diagram

```text
       CPU / HOST
            |
      Prepare Input
            |
      Transfer Data
            |
            v
       GPU / DEVICE
            |
       Kernel Launch
            |
      Thread Scheduling
            |
       SM Execution
            |
      Parallel Processing
            |
       Store Results
            |
      Transfer Results
            |
            v
       CPU / HOST
            |
       Final Output
```

### Important Performance Consideration

GPU execution time is not determined only by kernel execution.

A more complete measurement may include:

- CPU-side preparation.
    
- Kernel launch overhead.
    
- Host-to-device transfer.
    
- Kernel execution.
    
- Device-to-host transfer.
    
- Synchronization overhead.
    

For some small workloads, the overhead of using a GPU can be greater than the computational benefit.

---

## 10. GPU Performance Metrics

To evaluate GPU performance, CoreWise AI should consider multiple hardware and workload metrics.

|Metric|Meaning|
|---|---|
|GPU Utilization|Percentage of time the GPU is busy|
|SM Utilization|Activity of streaming multiprocessors|
|CUDA Core Count|Number of CUDA execution units|
|GPU Clock Frequency|Operating frequency of the GPU|
|Memory Bandwidth|Rate of data transfer to and from memory|
|Occupancy|Active warps relative to the hardware maximum|
|Kernel Latency|Time taken by a GPU kernel|
|Throughput|Amount of work completed per unit time|
|Warp Efficiency|Efficiency of warp execution|
|Memory Usage|GPU memory consumed by the workload|
|Power Consumption|Electrical power used by the GPU|
|GPU Temperature|Operating temperature of the GPU|
|Transfer Time|Time required for host-device data movement|

### Performance Measurement

For a workload:

Throughput=Number of OperationsExecution Time\text{Throughput} = \frac{\text{Number of Operations}} {\text{Execution Time}}

For example, if a GPU completes 10 million operations in 0.5 seconds:

Throughput=10,000,0000.5\text{Throughput} = \frac{10,000,000}{0.5} =20,000,000 operations/second= 20,000,000 \text{ operations/second}

---

## 11. Compute-Bound and Memory-Bound GPU Workloads

GPU workloads can be broadly categorized based on their main performance limitation.

### 11.1 Compute-Bound Workload

A compute-bound workload is primarily limited by processing capability.

Characteristics:

- Large number of arithmetic operations.
    
- High computational demand.
    
- Sufficient data availability.
    
- Performance strongly influenced by processing throughput.
    

Example: Large matrix multiplication.

### 11.2 Memory-Bound Workload

A memory-bound workload is primarily limited by data movement.

Characteristics:

- Frequent memory access.
    
- High memory bandwidth requirements.
    
- Low computational work relative to data movement.
    
- Performance affected by memory latency and bandwidth.
    

Example: Processing large arrays with relatively few operations per element.

### Arithmetic Intensity

Arithmetic intensity measures the number of arithmetic operations performed per byte of data transferred.

Arithmetic Intensity=Floating-Point OperationsBytes Transferred\text{Arithmetic Intensity} = \frac{\text{Floating-Point Operations}} {\text{Bytes Transferred}}

A higher arithmetic intensity often indicates greater computational work relative to data movement.

This concept is important when analyzing whether a GPU workload is limited by compute throughput or memory bandwidth.

---

## 12. GPU Bottlenecks

GPU performance can be limited by several factors.

### 12.1 Insufficient Parallelism

A workload may not contain enough independent operations to use the GPU effectively.

### 12.2 Memory Bottleneck

Data transfer and memory access can become the main performance limitation.

### 12.3 Kernel Launch Overhead

Small kernels may spend a significant portion of their total execution time on launch overhead.

### 12.4 Warp Divergence

Different execution paths within a warp can reduce execution efficiency.

### 12.5 Resource Constraints

High register or shared-memory requirements can reduce the number of active blocks and warps.

### 12.6 CPU-GPU Communication

Frequent data transfers and synchronization between CPU and GPU can increase total execution time.

---

## 13. GPU Profiling and Monitoring Tools

Profiling tools help identify GPU performance bottlenecks.

|Tool|Purpose|
|---|---|
|NVIDIA Nsight Systems|System-level CPU and GPU activity analysis|
|NVIDIA Nsight Compute|Detailed GPU kernel profiling|
|NVIDIA CUPTI|GPU profiling and telemetry interface|
|AMD ROCm Tools|Profiling and monitoring AMD GPU workloads|
|OpenVINO|AI inference across supported CPU and GPU devices|
|Python psutil|System-level CPU and memory monitoring|

### Important Profiling Metrics

- Kernel execution time.
    
- GPU utilization.
    
- SM utilization.
    
- Memory throughput.
    
- CPU launch overhead.
    
- CPU-GPU synchronization.
    
- Register usage.
    
- Shared-memory usage.
    
- Grid and block dimensions.
    

---

## 14. GPU Features for CoreWise AI

CoreWise AI needs GPU hardware and workload information to estimate GPU performance.

The following features are proposed for the prediction system.

### 14.1 Hardware Features

|Feature|Description|
|---|---|
|GPU Name|Model of the GPU|
|CUDA Core Count|Number of CUDA execution units, when applicable|
|SM Count|Number of streaming multiprocessors|
|GPU Clock|Operating frequency|
|VRAM Capacity|Available GPU memory capacity|
|Memory Bandwidth|GPU memory transfer capability|
|Compute Capability|Supported NVIDIA GPU architecture features|
|GPU Power|Power consumption|
|GPU Temperature|Thermal operating condition|

### 14.2 Workload Features

|Feature|Description|
|---|---|
|Input Size|Size of input data|
|Grid Dimensions|Number of thread blocks|
|Block Dimensions|Number of threads per block|
|Total Threads|Total number of launched threads|
|Shared Memory|Shared memory required per block|
|Registers|Register requirements|
|Arithmetic Intensity|Operations per byte transferred|
|Memory Access Pattern|How data is accessed|
|Parallelism Degree|Amount of available parallel work|
|Kernel Complexity|Computational complexity of the kernel|

### 14.3 Runtime Features

|Feature|Description|
|---|---|
|GPU Utilization|Actual GPU activity|
|SM Utilization|SM activity|
|Kernel Latency|Actual kernel execution time|
|Memory Throughput|Actual memory transfer rate|
|Occupancy|Active warp ratio|
|Power Consumption|Actual GPU power usage|
|Temperature|Actual operating temperature|

These features can be used to train a machine learning model that predicts GPU execution time.

---

## 15. GPU Performance Prediction

CoreWise AI can estimate GPU execution time using hardware specifications and workload characteristics.

A possible prediction model is:

TGPU=f(HGPU,W,R)T_{GPU} = f(H_{GPU}, W, R)

Where:

- TGPUT_{GPU} = Predicted GPU execution time.
    
- HGPUH_{GPU} = GPU hardware features.
    
- WW = Workload characteristics.
    
- RR = Runtime and profiling information.
    

### Proposed Input Features

```text
GPU Hardware
    |
    |-- SM Count
    |-- CUDA Core Count
    |-- GPU Clock
    |-- Memory Bandwidth
    |-- VRAM Capacity
    |
Workload Information
    |
    |-- Input Size
    |-- Arithmetic Intensity
    |-- Parallelism
    |-- Memory Access Pattern
    |-- Grid and Block Dimensions
    |
Runtime Information
    |
    |-- GPU Utilization
    |-- Kernel Latency
    |-- Memory Throughput
    |-- Occupancy
    |
    v
Machine Learning Model
    |
    v
Predicted GPU Execution Time
```

**Important:** This is a proposed CoreWise AI design. The prediction model must be trained and evaluated using actual benchmark measurements. Hardware specifications alone cannot guarantee accurate execution-time predictions.

---

## 16. CPU vs GPU Architecture

|Parameter|CPU|GPU|
|---|---|---|
|Main Design|General-purpose processing|Parallel processing|
|Processing Units|Smaller number of complex cores|Many execution units|
|Control Logic|More complex|Optimized for parallel execution|
|Thread Execution|Strong individual-thread performance|Large-scale thread execution|
|Parallelism|Task and thread-level|Massive data parallelism|
|Memory|System RAM and CPU caches|VRAM and GPU memory hierarchy|
|Best Workloads|Sequential and control-heavy tasks|Highly parallel computational tasks|
|Examples|Operating systems, application logic|Matrix operations, image processing|

### CoreWise AI Decision

The fastest processor depends on the workload.

A CPU may perform better when:

- The workload is small.
    
- The workload has sequential dependencies.
    
- GPU launch overhead is significant.
    
- Data transfer overhead is high.
    

A GPU may perform better when:

- The workload contains substantial parallelism.
    
- Many similar operations can execute simultaneously.
    
- The computational workload is sufficiently large.
    
- Data movement and memory requirements are manageable.
    

---

## 17. Practical Experiments for CoreWise AI

The following experiments can help validate GPU performance predictions.

### Experiment 1: Matrix Multiplication

**Objective:** Compare CPU and GPU execution for matrix multiplication.

Test different matrix sizes:

- 128 × 128.
    
- 512 × 512.
    
- 1024 × 1024.
    
- 2048 × 2048.
    

Record:

- CPU execution time.
    
- GPU execution time.
    
- Data transfer time.
    
- Total execution time.
    
- Throughput.
    

### Experiment 2: Different Workload Sizes

**Objective:** Identify the workload size at which GPU execution becomes beneficial.

Test small, medium, and large workloads.

Observe how launch and transfer overhead affect performance.

### Experiment 3: Memory-Bound Workload

**Objective:** Analyze the effect of memory access on GPU performance.

Record:

- Memory throughput.
    
- Execution time.
    
- GPU utilization.
    
- Data transfer time.
    

### Experiment 4: GPU Resource Utilization

**Objective:** Analyze the relationship between GPU resource usage and performance.

Record:

- SM utilization.
    
- Occupancy.
    
- Register usage.
    
- Shared-memory usage.
    
- Kernel latency.
    

---

## 18. Reference Projects and Research Connections

The following repositories provide implementation ideas relevant to GPU performance analysis.

### Dynamic AI-Driven CUDA Kernel Scheduler

Relevant concepts:

- CUDA kernel monitoring.
    
- CUPTI telemetry.
    
- SM utilization.
    
- Grid and block dimensions.
    
- Arithmetic intensity.
    
- Memory access patterns.
    
- Machine learning-based execution-time prediction.
    

**CoreWise AI application:** Use similar workload and hardware features as candidate inputs for predicting GPU execution time.

### PerfAdvisor

Relevant concepts:

- GPU kernel profiling.
    
- CPU launch overhead.
    
- GPU activity analysis.
    
- Memory transfer analysis.
    
- Performance bottleneck identification.
    
- Amdahl's Law-based speedup estimation.
    

**CoreWise AI application:** Use profiling information to explain why a workload performs better or worse on a GPU.

### AI Workload Benchmarking Framework

Relevant concepts:

- CPU versus GPU inference benchmarking.
    
- Latency measurement.
    
- Throughput measurement.
    
- CPU and memory monitoring.
    
- GPU monitoring where supported.
    
- Performance comparison across devices.
    

**CoreWise AI application:** Use reproducible benchmarks to build and validate the CPU-GPU prediction dataset.

---

## 19. Key Takeaways

1. GPUs are designed for highly parallel workloads.
    
2. Streaming Multiprocessors are major GPU processing units in NVIDIA architecture.
    
3. CUDA cores execute arithmetic and logical operations.
    
4. CUDA uses a grid, block, and thread hierarchy.
    
5. A standard NVIDIA CUDA warp contains 32 threads.
    
6. Occupancy depends on available hardware resources and workload configuration.
    
7. Memory bandwidth and data movement strongly influence GPU performance.
    
8. Kernel launch overhead can make GPU execution inefficient for small workloads.
    
9. Profiling metrics help identify GPU performance bottlenecks.
    
10. CoreWise AI can use hardware, workload, and runtime features to predict GPU performance.
    

---

## 20. Related Obsidian Notes

- [CPU-Architecture](CPU-Architecture.md.md)
    
- [Parallel-Processing](Parallel-Processing.md.md)
    
- [Memory-Hierarchy](Memory-Hierarchy.md.md)
    
- [Amdahls-Law](Amdahls-Law.md.md)
    
- [[Research-Papers]]
    
- [Literature-Review](../01-Research/Research-Papers/Literature-Review.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    
- [[Benchmarking-Methodology]]
    

---

## Document Status

## **Status:** Initial research documentation  
**Project:** CoreWise AI  
**Category:** Computer Organization and Architecture  
**Next Document:** `Parallel-Processing.md`