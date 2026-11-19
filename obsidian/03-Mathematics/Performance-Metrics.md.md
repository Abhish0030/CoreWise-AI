---

title: Performance Metrics  
project: CoreWise AI  
category: Mathematics  
tags:

- performance-metrics
    
- CPU
    
- GPU
    
- benchmarking
    
- latency
    
- throughput
    
- utilization
    
- power-efficiency  
    status: Research
    

---

# Performance Metrics

## 1. Introduction

Performance metrics are measurable values used to evaluate the efficiency, speed, resource utilization, and overall performance of a computing system.

In computer architecture, performance depends on multiple factors, including processing capability, memory performance, workload characteristics, and resource utilization.

CoreWise AI uses performance metrics to compare CPU and GPU execution and identify the most suitable processor for a given workload.

### Main Objectives

- Measure processor execution time.
    
- Evaluate computational throughput.
    
- Calculate CPU-GPU speedup.
    
- Monitor hardware utilization.
    
- Analyze memory performance.
    
- Evaluate power efficiency.
    
- Support ML-based performance prediction.
    
- Generate explainable processor recommendations.
    

---

## 2. Classification of Performance Metrics

CoreWise AI can organize performance metrics into six major categories.

|Category|Important Metrics|
|---|---|
|Execution Performance|Execution time, latency, speedup|
|Computational Performance|FLOPS, IPS, throughput|
|Resource Utilization|CPU utilization, GPU utilization, occupancy|
|Memory Performance|Memory bandwidth, latency, cache misses|
|Energy Performance|Power consumption, energy per task|
|Benchmark Evaluation|MAE, RMSE, R², prediction error|

---

## 3. Execution Time

Execution time represents the total time required to complete a computational workload.

T=Tfinish−Tstart\boxed{T=T_{finish}-T_{start}}

Where:

- TT = Execution time.
    
- TstartT_{start} = Starting time.
    
- TfinishT_{finish} = Completion time.
    

### CPU Execution Time

TCPU=IC×CPIf\boxed{ T_{CPU}=\frac{IC\times CPI}{f} }

Where:

- IC = Instruction Count.
    
- CPI = Average Cycles Per Instruction.
    
- ff = Clock Frequency.
    

### GPU Execution Time

A simplified end-to-end GPU execution model is:

TGPU=TH2D+Tlaunch+Tkernel+TD2H+TsyncT_{GPU}= T_{H2D}+T_{launch}+T_{kernel}+T_{D2H}+T_{sync}

Where:

- TH2DT_{H2D} = Host-to-device transfer time.
    
- TlaunchT_{launch} = Kernel launch overhead.
    
- TkernelT_{kernel} = Kernel execution time.
    
- TD2HT_{D2H} = Device-to-host transfer time.
    
- TsyncT_{sync} = Additional synchronization overhead.
    

**CoreWise AI application:** Execution time is the primary target for CPU-GPU performance prediction.

---

## 4. Latency

Latency measures the time taken to complete an operation or respond to a request.

It is especially important in interactive applications, AI inference, and real-time processing.

### Formula

Latency=Tcompletion−Trequest\boxed{ Latency=T_{completion}-T_{request} }

### Example

Suppose an AI inference request takes 50 milliseconds to return a result.

Latency=50 msLatency=50\ ms

### Types of Latency

|Type|Description|
|---|---|
|Execution Latency|Time taken to execute an operation|
|Memory Latency|Time required to complete a memory access|
|Network Latency|Time taken for data to travel across a network|
|Kernel Latency|Time taken by a GPU kernel|
|Inference Latency|Time required to generate a prediction|

### CoreWise AI application

Latency helps evaluate whether a processor is suitable for applications requiring fast responses.

---

## 5. Throughput

Throughput measures the amount of computational work completed per unit of time.

### Formula

Throughput=Total WorkExecution Time\boxed{ Throughput=\frac{Total\ Work}{Execution\ Time} }

### Example

Suppose a GPU processes 100,000 images in 20 seconds.

Throughput=100,00020Throughput=\frac{100,000}{20} Throughput=5,000 images/second\boxed{Throughput=5,000\ images/second}

### Common Throughput Units

- Operations/second.
    
- Instructions/second.
    
- Images/second.
    
- Samples/second.
    
- Requests/second.
    
- Tokens/second.
    
- FLOPS.
    

**CoreWise AI application:** Throughput helps compare the processing capacity of different hardware configurations.

---

## 6. FLOPS

FLOPS represents floating-point operations per second.

It measures the computational rate of a processor.

### Formula

FLOPS=Total Floating Point OperationsExecution Time\boxed{ FLOPS=\frac{Total\ Floating\ Point\ Operations}{Execution\ Time} }

### Common Units

|Unit|Value|
|---|--:|
|MFLOPS|10610^6 FLOPS|
|GFLOPS|10910^9 FLOPS|
|TFLOPS|101210^{12} FLOPS|
|PFLOPS|101510^{15} FLOPS|
|EFLOPS|101810^{18} FLOPS|

### Important Consideration

Peak FLOPS represents theoretical computational capability. Actual application performance may be lower because of memory limitations, instruction mix, and workload characteristics.

**CoreWise AI application:** FLOPS can help characterize computational workloads and processor capabilities.

---

## 7. CPU Utilization

CPU utilization represents the percentage of available CPU processing capacity being used during a measurement interval.

### Formula

CPU Utilization=CPU Busy TimeTotal CPU Time×100\boxed{ CPU\ Utilization= \frac{CPU\ Busy\ Time}{Total\ CPU\ Time} \times100 }

### Example

Suppose a CPU remains busy for 8 seconds during a 10-second measurement interval.

CPU Utilization=810×100CPU\ Utilization=\frac{8}{10}\times100 CPU Utilization=80%\boxed{CPU\ Utilization=80\%}

### Interpretation

- Low utilization may indicate that the workload is not fully using available CPU resources.
    
- High utilization indicates substantial CPU activity.
    
- High utilization does not necessarily mean high performance.
    

**CoreWise AI application:** CPU utilization helps understand how effectively a workload uses available CPU resources.

---

## 8. GPU Utilization

GPU utilization indicates how busy the GPU is during a measurement interval.

It helps identify whether a workload effectively uses available GPU resources.

### Example

Suppose a GPU is reported as busy for 7 seconds during a 10-second interval.

GPU Utilization=710×100GPU\ Utilization=\frac{7}{10}\times100 GPU Utilization=70%\boxed{GPU\ Utilization=70\%}

### Important Consideration

GPU utilization is not the same as occupancy.

- GPU utilization measures device activity over time.
    
- Occupancy measures active warps relative to the maximum supported warps on an SM.
    

A GPU may show high utilization without achieving maximum occupancy.

**CoreWise AI application:** GPU utilization helps evaluate how effectively workloads use GPU processing resources.

---

## 9. GPU Occupancy

Occupancy measures the proportion of maximum supported warps that are active on an SM.

### Formula

Occupancy=Active WarpsMaximum Supported Warps×100\boxed{ Occupancy= \frac{Active\ Warps}{Maximum\ Supported\ Warps} \times100 }

### Example

Suppose:

- Maximum supported warps = 64.
    
- Active warps = 32.
    

Occupancy=3264×100Occupancy=\frac{32}{64}\times100 Occupancy=50%\boxed{Occupancy=50\%}

### Factors Affecting Occupancy

- Registers per thread.
    
- Shared memory per block.
    
- Threads per block.
    
- Hardware resource limits.
    

Higher occupancy does not automatically guarantee higher performance.

**CoreWise AI application:** Occupancy can be used as a GPU workload feature when reliable profiling information is available.

---

## 10. Memory Bandwidth

Memory bandwidth measures the amount of data transferred per unit of time.

### Formula

Bandwidth=Data TransferredTransfer Time\boxed{ Bandwidth=\frac{Data\ Transferred}{Transfer\ Time} }

### Example

Suppose 20 GB of data is transferred in 5 seconds.

Bandwidth=205Bandwidth=\frac{20}{5} Bandwidth=4 GB/s\boxed{Bandwidth=4\ GB/s}

### Units

- MB/s.
    
- GB/s.
    
- TB/s.
    

### Importance

Low effective memory bandwidth can restrict processor performance even when computational resources are available.

**CoreWise AI application:** Memory bandwidth helps identify memory-bound workloads.

---

## 11. Cache Hit Rate and Miss Rate

Cache hit rate measures the percentage of memory requests successfully served by cache.

### Cache Hit Rate

Hit Rate=Cache HitsTotal Cache Accesses×100\boxed{ Hit\ Rate= \frac{Cache\ Hits}{Total\ Cache\ Accesses} \times100 }

### Cache Miss Rate

Miss Rate=Cache MissesTotal Cache Accesses×100\boxed{ Miss\ Rate= \frac{Cache\ Misses}{Total\ Cache\ Accesses} \times100 }

For a consistent set of cache accesses:

Hit Rate+Miss Rate=100%Hit\ Rate+Miss\ Rate=100\%

### Example

Suppose:

- Total cache accesses = 1,000.
    
- Cache hits = 900.
    
- Cache misses = 100.
    

Hit Rate=9001000×100Hit\ Rate=\frac{900}{1000}\times100 Hit Rate=90%\boxed{Hit\ Rate=90\%} Miss Rate=1001000×100Miss\ Rate=\frac{100}{1000}\times100 Miss Rate=10%\boxed{Miss\ Rate=10\%}

**CoreWise AI application:** Cache behavior can help explain CPU performance differences between workloads.

---

## 12. Arithmetic Intensity

Arithmetic intensity measures the amount of computation performed relative to data transferred.

### Formula

AI=Floating Point OperationsBytes Transferred\boxed{ AI=\frac{Floating\ Point\ Operations}{Bytes\ Transferred} }

### Example

Suppose a workload performs:

- 5 million floating-point operations.
    
- 1 million bytes of memory transfer.
    

AI=5,000,0001,000,000AI=\frac{5,000,000}{1,000,000} AI=5 FLOPs/Byte\boxed{AI=5\ FLOPs/Byte}

### Interpretation

- Low arithmetic intensity may indicate memory-bound behavior.
    
- High arithmetic intensity may indicate greater computational demand relative to data movement.
    

**CoreWise AI application:** Arithmetic intensity can help classify workloads and estimate their suitability for CPU or GPU execution.

---

## 13. Power Consumption

Power consumption measures the rate at which a processor consumes electrical energy.

It is commonly measured in watts.

Power=EnergyTime\boxed{ Power=\frac{Energy}{Time} }

Where:

- Power = Electrical power in watts.
    
- Energy = Energy consumed in joules.
    
- Time = Measurement interval in seconds.
    

### Example

Suppose a processor consumes 200 joules over 10 seconds.

Power=20010Power=\frac{200}{10} Power=20 W\boxed{Power=20\ W}

### Importance

Power consumption is important when comparing energy-efficient processor configurations.

A processor with lower execution time may consume more power.

Therefore, performance should also be evaluated against energy consumption.

---

## 14. Energy Consumption

Energy consumption represents the total energy used to execute a workload.

### Formula

E=P×T\boxed{ E=P\times T }

Where:

- EE = Energy in joules.
    
- PP = Average power in watts.
    
- TT = Execution time in seconds.
    

### Example

Suppose:

- Average power = 50 W.
    
- Execution time = 4 seconds.
    

E=50×4E=50\times4 E=200 J\boxed{E=200\ J}

### Energy Efficiency

A workload's energy efficiency can be expressed as:

Energy Efficiency=Useful WorkEnergy ConsumedEnergy\ Efficiency= \frac{Useful\ Work}{Energy\ Consumed}

For example, operations per joule can be used when the workload has a clearly defined operation count.

**CoreWise AI application:** Energy consumption can support energy-aware processor recommendations.

---

## 15. Temperature and Thermal Throttling

Processor temperature affects operating conditions and can influence performance.

Thermal throttling occurs when a processor reduces its operating frequency or power to control temperature.

### Important Metrics

- CPU temperature.
    
- GPU temperature.
    
- Maximum operating temperature.
    
- Clock frequency.
    
- Thermal throttling status.
    

### Example

A CPU may initially operate at a high frequency but reduce its frequency after reaching a thermal or power limit.

This can increase execution time.

**CoreWise AI application:** Temperature and frequency measurements can help explain inconsistent benchmark results.

---

## 16. Benchmark Evaluation Metrics

CoreWise AI uses machine learning to predict processor execution time.

Therefore, the prediction model must be evaluated using appropriate statistical metrics.

Let:

- yiy_i = Actual execution time.
    
- y^i\hat{y}_i = Predicted execution time.
    
- nn = Number of observations.
    

### 16.1 Mean Absolute Error (MAE)

MAE measures the average absolute difference between actual and predicted values.

MAE=1n∑i=1n∣yi−y^i∣\boxed{ MAE=\frac{1}{n}\sum_{i=1}^{n}|y_i-\hat{y}_i| }

Lower MAE indicates better prediction accuracy.

### 16.2 Mean Squared Error (MSE)

MSE calculates the average squared prediction error.

MSE=1n∑i=1n(yi−y^i)2\boxed{ MSE=\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat{y}_i)^2 }

Larger errors receive greater penalties because the differences are squared.

### 16.3 Root Mean Squared Error (RMSE)

RMSE is the square root of MSE.

RMSE=1n∑i=1n(yi−y^i)2\boxed{ RMSE=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat{y}_i)^2} }

RMSE is expressed in the same units as the target variable.

### 16.4 Coefficient of Determination (R²)

R² measures how well the model explains variation in the actual target values.

R2=1−∑(yi−y^i)2∑(yi−yˉ)2\boxed{ R^2=1-\frac{\sum(y_i-\hat{y}_i)^2} {\sum(y_i-\bar{y})^2} }

Where:

- yˉ\bar{y} = Mean of actual values.
    

An R² value closer to 1 generally indicates a better fit.

However, R² should not be used alone to evaluate execution-time predictions.

### 16.5 Mean Absolute Percentage Error (MAPE)

MAPE measures average absolute prediction error as a percentage.

MAPE=100n∑i=1n∣yi−y^iyi∣\boxed{ MAPE=\frac{100}{n} \sum_{i=1}^{n} \left|\frac{y_i-\hat{y}_i}{y_i}\right| }

MAPE is undefined when an actual target value is zero and can become misleading when actual values are very close to zero.

---

## 17. Performance Metrics Summary

|Metric|Formula|Unit|
|---|---|---|
|Execution Time|T=Tfinish−TstartT=T_{finish}-T_{start}|Seconds|
|Latency|Tcompletion−TrequestT_{completion}-T_{request}|ms or seconds|
|Throughput|Work / Time|Operations/s|
|FLOPS|FLOPs / Time|FLOPS|
|CPU Utilization|Busy Time / Total Time × 100|%|
|GPU Utilization|Busy Time / Total Time × 100|%|
|Occupancy|Active Warps / Maximum Warps × 100|%|
|Memory Bandwidth|Data / Time|GB/s|
|Cache Hit Rate|Hits / Accesses × 100|%|
|Arithmetic Intensity|FLOPs / Bytes|FLOPs/Byte|
|Power|Energy / Time|Watts|
|Energy|Power × Time|Joules|
|MAE|Mean absolute error|Target unit|
|RMSE|Root mean squared error|Target unit|
|R²|Coefficient of determination|Dimensionless|

---

## 18. Performance Metrics for CoreWise AI

The proposed system should use different metrics for different stages.

### A. Hardware Analysis

- CPU core count.
    
- GPU SM count.
    
- Clock frequency.
    
- RAM and VRAM capacity.
    
- Memory bandwidth.
    

### B. Workload Analysis

- Input size.
    
- Operation count.
    
- Parallelizable fraction.
    
- Arithmetic intensity.
    
- Memory access pattern.
    

### C. Benchmarking

- Execution time.
    
- Latency.
    
- Throughput.
    
- CPU utilization.
    
- GPU utilization.
    
- Memory consumption.
    
- Transfer time.
    
- Power consumption.
    

### D. Machine Learning Evaluation

- MAE.
    
- MSE.
    
- RMSE.
    
- R².
    
- MAPE, where appropriate.
    

### E. Recommendation

- Predicted CPU execution time.
    
- Predicted GPU execution time.
    
- Predicted speedup.
    
- Resource compatibility.
    
- Prediction uncertainty.
    

---

## 19. Proposed Performance Analysis Workflow

```text
          Workload Input
                |
                v
         Hardware Detection
                |
                v
          Workload Analysis
                |
                v
         Benchmark Execution
                |
                v
        Performance Collection
                |
       ----------------------
       |          |         |
       v          v         v
   Execution   Resource   Energy
     Time     Utilization Analysis
       |          |         |
       ----------------------
                |
                v
        Feature Extraction
                |
                v
          ML Prediction
                |
                v
        Model Evaluation
                |
                v
       CPU vs GPU Comparison
                |
                v
       Processor Recommendation
```

---

## 20. Important Considerations

1. Metrics must be collected using consistent measurement methods.
    
2. CPU and GPU comparisons must use equivalent workloads.
    
3. GPU utilization must not be confused with occupancy.
    
4. Peak FLOPS must not be treated as actual application throughput.
    
5. Power consumption and energy consumption are different measurements.
    
6. Benchmark results should include repeated measurements.
    
7. Prediction metrics should be calculated on unseen test data.
    
8. MAPE should be avoided or handled carefully when actual execution times are zero or close to zero.
    
9. Hardware-specific metrics should only be collected when supported.
    
10. The system should distinguish measured values from predicted values.
    

---

## 21. Key Takeaways

1. Performance metrics provide quantitative information about processor behavior.
    
2. Execution time and latency measure completion time.
    
3. Throughput measures completed work per unit of time.
    
4. FLOPS measures floating-point computational rate.
    
5. CPU and GPU utilization measure resource activity.
    
6. Occupancy measures active GPU warps relative to hardware limits.
    
7. Memory bandwidth and cache behavior influence execution performance.
    
8. Power and energy metrics support efficiency analysis.
    
9. MAE, RMSE, and R² evaluate ML prediction quality.
    
10. CoreWise AI combines these metrics to produce more reliable processor recommendations.
    

---

## 22. Related Obsidian Notes

- [Execution-Time](Execution-Time.md.md)
    
- [Speedup](Speedup.md.md)
    
- [Throughput](Throughput.md.md)
    
- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Parallel-Processing](../02-COA-Concepts/Parallel-Processing.md.md)
    
- [Memory-Hierarchy](../02-COA-Concepts/Memory-Hierarchy.md.md)
    
- [Amdahls-Law](../02-COA-Concepts/Amdahls-Law.md.md)
    
- [[Benchmarking-Methodology]]
    
- [[ML-Prediction-Model]]
    
- [Feature-Engineering](../04-Machine-Learning/Feature-Engineering.md.md)
    

---

## Document Status

## **Status:** Initial mathematical documentation  
**Project:** CoreWise AI  
**Category:** Mathematics  
**Next Section:** Machine Learning documentation