# Dataset Preparation for CoreWise AI

## 1. Introduction

The dataset is one of the most important components of the CoreWise AI system. The Machine Learning model uses benchmark data to understand how different workloads perform on different hardware configurations.

CoreWise AI aims to predict whether a workload will execute more efficiently on a CPU or GPU. To achieve this, the model needs historical benchmark measurements containing workload characteristics, hardware specifications, and actual execution times.

The dataset acts as the foundation for supervised learning.

The general relationship is:

ExecutionTime=f(WorkloadFeatures,HardwareFeatures)ExecutionTime=f(WorkloadFeatures,HardwareFeatures)

The model learns this relationship from previously collected benchmark observations and uses it to predict execution time for new workloads.

## 2. Dataset Objectives

The dataset should support the following objectives:

1. Store benchmark results for CPU and GPU execution.
    
2. Capture workload characteristics such as input size and computational complexity.
    
3. Record hardware specifications for each processor.
    
4. Identify how workload characteristics influence execution time.
    
5. Train machine learning models for execution-time prediction.
    
6. Evaluate model performance on unseen workloads and hardware configurations.
    
7. Support processor recommendation based on predicted execution time.
    

## 3. Dataset Structure

Each dataset record represents one benchmark observation for a particular workload executed on a particular hardware configuration.

A recommended dataset structure is:

|Feature|Description|Example|
|---|---|---|
|benchmark_id|Unique benchmark identifier|B001|
|workload_name|Name of the workload|Matrix Multiplication|
|workload_type|Category of workload|Compute-intensive|
|input_size|Size of input data|1024|
|operation_count|Estimated number of operations|2.1 billion|
|parallel_fraction|Estimated parallelizable fraction|0.90|
|arithmetic_intensity|FLOPs per byte transferred|12.5|
|memory_access_pattern|Memory access behavior|Sequential|
|processor_type|CPU or GPU|GPU|
|processor_model|Hardware model|Example GPU|
|core_count|Number of CPU cores, where applicable|8|
|sm_count|GPU streaming multiprocessor count|20|
|clock_frequency|Processor clock frequency|3.5 GHz|
|memory_bandwidth|Available memory bandwidth|400 GB/s|
|memory_capacity|Available memory capacity|16 GB|
|data_transfer_bytes|Data transferred between host and device|100 MB|
|execution_time_ms|Measured execution time|25 ms|

_The example values are illustrative. Actual values must come from benchmark measurements and hardware specifications._

## 4. Workload Categories

The dataset should contain different types of workloads because CPU and GPU performance depends heavily on the nature of the computation.

### 4.1 Compute-Intensive Workloads

These workloads perform a large number of calculations relative to memory transfers.

Examples:

- Matrix multiplication.
    
- Image convolution.
    
- Numerical simulations.
    
- Scientific computing.
    

They may benefit from GPU parallel processing when the workload is sufficiently large.

### 4.2 Memory-Intensive Workloads

These workloads spend a significant amount of time accessing or transferring data.

Examples:

- Vector operations.
    
- Large array processing.
    
- Memory-intensive transformations.
    
- Data movement operations.
    

Their performance can be limited by memory bandwidth and access patterns.

### 4.3 Sequential Workloads

These workloads contain dependencies that restrict parallel execution.

Examples:

- Sequential algorithms.
    
- Dependency-heavy computations.
    
- Certain sorting and processing operations.
    

They may perform efficiently on CPUs because of lower execution overhead and strong sequential processing capabilities.

### 4.4 Parallel Workloads

These workloads contain operations that can execute independently.

Examples:

- Large matrix operations.
    
- Image processing.
    
- Parallel numerical computations.
    
- Batch processing.
    

They may benefit from GPU execution because GPUs contain many parallel processing units.

## 5. Hardware Information

Hardware information is necessary because the same workload may behave differently on different processors.

### 5.1 CPU Features

The dataset should record:

- CPU manufacturer and model.
    
- Number of physical cores.
    
- Number of logical threads.
    
- Base and maximum clock frequency.
    
- Cache size.
    
- RAM capacity.
    
- Memory bandwidth, where available.
    
- Instruction set information, where relevant.
    

### 5.2 GPU Features

The dataset should record:

- GPU manufacturer and model.
    
- Number of streaming multiprocessors.
    
- CUDA cores or equivalent processing-unit information, where applicable.
    
- GPU clock frequency.
    
- VRAM capacity.
    
- Memory bandwidth.
    
- Compute capability or equivalent architecture information.
    
- Supported computing frameworks.
    

### 5.3 System-Level Features

Other useful information includes:

- Operating system.
    
- Compiler version.
    
- GPU driver version.
    
- Benchmark framework.
    
- Power configuration.
    
- Processor temperature.
    
- Software library versions.
    

These details help identify environmental differences that may affect benchmark measurements.

## 6. Target Variables

The main prediction targets are actual execution times.

### CPU Execution Time

YCPU=TCPUY_{CPU}=T_{CPU}

This represents the measured time required to execute the workload on the CPU.

### GPU Execution Time

YGPU=TGPUY_{GPU}=T_{GPU}

This represents the measured time required to execute the workload on the GPU.

The models learn to estimate these target values using workload and hardware features.

T^CPU=fθ(XCPU)\hat{T}_{CPU}=f_{\theta}(X_{CPU}) T^GPU=gϕ(XGPU)\hat{T}_{GPU}=g_{\phi}(X_{GPU})

Where:

- XCPUX_{CPU} and XGPUX_{GPU} are the corresponding input feature vectors.
    
- fθf_{\theta} and gϕg_{\phi} are trained prediction models.
    
- T^\hat{T} represents predicted execution time.
    

## 7. Benchmark Data Collection

The dataset can be created by running controlled experiments on CPU and GPU hardware.

### Step 1: Select Workloads

Choose representative workloads such as:

- Matrix multiplication.
    
- Vector addition.
    
- Image processing.
    
- Sorting.
    
- Convolution.
    
- Numerical computation.
    

### Step 2: Execute on CPU

Run the workload using an appropriate CPU implementation.

Record:

- Execution time.
    
- Input size.
    
- CPU model.
    
- CPU utilization.
    
- Memory usage.
    
- Software configuration.
    

### Step 3: Execute on GPU

Run an equivalent implementation on the GPU.

Record:

- End-to-end execution time.
    
- Kernel execution time.
    
- Host-to-device transfer time.
    
- Device-to-host transfer time.
    
- GPU model.
    
- GPU memory usage.
    
- Software configuration.
    

### Step 4: Repeat Measurements

Run each benchmark multiple times under controlled conditions.

For nn measurements, average execution time can be calculated as:

Tavg=1n∑i=1nTiT_{avg}=\frac{1}{n}\sum_{i=1}^{n}T_i

Standard deviation can measure the variation:

σ=1n∑i=1n(Ti−Tavg)2\sigma=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(T_i-T_{avg})^2}

Repeated measurements help reduce the influence of temporary system fluctuations.

For more robust analysis, the dataset may also store the median and percentile execution times.

## 8. Consistent Execution-Time Measurement

CPU and GPU execution times must be measured using comparable boundaries.

For example, GPU end-to-end execution time may include:

TGPU=TH2D+TLaunch+TKernel+TD2H+TSyncT_{GPU}=T_{H2D}+T_{Launch}+T_{Kernel}+T_{D2H}+T_{Sync}

Where:

- TH2DT_{H2D} = host-to-device transfer time.
    
- TLaunchT_{Launch} = kernel launch overhead.
    
- TKernelT_{Kernel} = kernel execution time.
    
- TD2HT_{D2H} = device-to-host transfer time.
    
- TSyncT_{Sync} = synchronization overhead.
    

This is a simplified additive model. If operations overlap, their durations must not be added as though they were entirely sequential.

The CPU measurement should use equivalent workload boundaries, including necessary input preparation and output handling.

CoreWise AI should clearly distinguish between:

- Kernel-only execution time.
    
- Processor execution time.
    
- End-to-end application execution time.
    

For processor recommendation, end-to-end time is generally the most useful target when the objective is to determine which execution path completes the task sooner.

## 9. Dataset Preprocessing

Raw benchmark data may contain missing values, inconsistent units, invalid measurements, and duplicate records.

Preprocessing improves dataset quality before model training.

### 9.1 Missing Value Handling

Identify missing feature values.

Possible strategies:

- Remove records with invalid target measurements.
    
- Use suitable imputation for missing numerical features.
    
- Use an explicit unknown category for missing categorical features.
    
- Preserve missingness indicators when missing values carry useful information.
    

Target execution times should not be fabricated or imputed without a justified measurement methodology.

### 9.2 Duplicate Removal

Repeated benchmark measurements should not automatically be treated as accidental duplicates.

They may represent legitimate repeated trials.

Instead, remove accidental duplicate records while preserving repeated measurements and their trial identifiers.

### 9.3 Unit Standardization

Convert measurements into consistent units.

Examples:

|Measurement|Standard Unit|
|---|---|
|Execution time|Milliseconds|
|Memory capacity|GB|
|Memory bandwidth|GB/s|
|Clock frequency|GHz|
|Data transfer|MB or GB|
|Input size|Defined workload-specific unit|

### 9.4 Outlier Detection

Outliers can be identified using statistical methods.

For example, the Interquartile Range method:

IQR=Q3−Q1IQR=Q_3-Q_1

Lower bound:

L=Q1−1.5(IQR)L=Q_1-1.5(IQR)

Upper bound:

U=Q3+1.5(IQR)U=Q_3+1.5(IQR)

Values outside these bounds should be investigated.

An outlier may indicate a measurement error, but it may also represent genuine system behavior such as thermal throttling or memory contention. It should not be removed automatically.

## 10. Feature and Target Separation

The dataset must separate model inputs from prediction targets.

### Input Features

- Workload type.
    
- Input size.
    
- Operation count.
    
- Parallelizable fraction.
    
- Arithmetic intensity.
    
- Memory access pattern.
    
- CPU specifications.
    
- GPU specifications.
    
- Data transfer volume.
    
- Relevant software and system configuration.
    

### Target Variables

- Actual CPU execution time.
    
- Actual GPU execution time.
    

For a pre-execution prediction model, avoid using measurements that are only available after the workload begins.

For example, actual GPU utilization during execution should not be used as an input feature if the objective is to predict performance before execution.

Otherwise, the model may learn from information that would not be available when making a real recommendation. This is known as data leakage.

## 11. Dataset Splitting

The dataset should be divided into three subsets.

|Dataset|Suggested Percentage|Purpose|
|---|--:|---|
|Training|70%|Learn model parameters|
|Validation|15%|Tune hyperparameters|
|Testing|15%|Evaluate final performance|

These percentages are an initial suggestion, not a mandatory requirement.

### Important: Group-Based Splitting

Random splitting can produce misleading results when similar benchmark records appear in multiple subsets.

For example, the same matrix multiplication workload on the same GPU may appear in both training and testing data.

The model may memorize characteristics of that configuration rather than learn general performance relationships.

CoreWise AI should consider:

- Grouping records by workload.
    
- Grouping records by hardware configuration.
    
- Holding out entire hardware configurations to test hardware generalization.
    
- Holding out workload families to test generalization to new workload types.
    

The split strategy should match the intended deployment scenario.

## 12. Dataset Storage Format

CSV is a convenient initial format for benchmark data.

Example:

```csv
benchmark_id,workload_name,input_size,processor_type,processor_model,execution_time_ms
B001,MatrixMultiplication,512,CPU,ExampleCPU,42
B002,MatrixMultiplication,512,GPU,ExampleGPU,8
B003,VectorAddition,1000,CPU,ExampleCPU,2
B004,VectorAddition,1000,GPU,ExampleGPU,5
```

For larger projects, structured storage can be maintained in PostgreSQL.

A possible database design includes:

### Workloads Table

|Column|Description|
|---|---|
|workload_id|Unique workload identifier|
|workload_name|Workload name|
|workload_type|Workload category|
|input_size|Input dimensions or size|
|operation_count|Estimated operation count|
|arithmetic_intensity|FLOPs per byte|

### Hardware Table

|Column|Description|
|---|---|
|hardware_id|Unique hardware identifier|
|processor_type|CPU or GPU|
|manufacturer|Hardware manufacturer|
|model_name|Processor model|
|core_count|CPU cores, where applicable|
|sm_count|GPU SMs, where applicable|
|memory_capacity|Memory capacity|
|memory_bandwidth|Memory bandwidth|

### Benchmark Results Table

|Column|Description|
|---|---|
|benchmark_id|Unique benchmark identifier|
|workload_id|Associated workload|
|hardware_id|Associated hardware|
|execution_time_ms|Measured execution time|
|trial_number|Measurement repetition|
|timestamp|Measurement time|
|environment_id|Benchmark environment|

This structure makes it easier to compare workloads across multiple hardware configurations.

## 13. Data Quality Validation

Before training, validate the dataset.

Important checks include:

- Execution time must be positive.
    
- Measurement units must be consistent.
    
- Workload identifiers must be valid.
    
- Hardware identifiers must reference known configurations.
    
- CPU and GPU implementations must perform equivalent computations.
    
- Benchmark trials must be distinguishable.
    
- Missing target values must be investigated.
    
- Measurement boundaries must be documented.
    
- Training and testing partitions must not contain unintended leakage.
    

A dataset quality report should summarize the number of records, missing values, unique workloads, hardware configurations, and measurement ranges.

## 14. Dataset Expansion Strategy

The dataset can grow through multiple sources:

### Initial Benchmark Dataset

Collect measurements from available CPU and GPU hardware using controlled workloads.

### Public Benchmark Datasets

Where licensing and measurement compatibility permit, public benchmark datasets can supplement locally collected data.

### Automated Benchmark Collection

Develop scripts to execute workloads, collect measurements, and store results automatically.

### Continuous Dataset Updates

When new hardware configurations or software environments become available, collect additional benchmark records.

New data should be validated before being added to the training dataset.

## 15. Challenges and Solutions

|Challenge|Impact|Possible Solution|
|---|---|---|
|Insufficient benchmark data|Poor generalization|Expand workload and hardware coverage|
|Inconsistent measurements|Unreliable targets|Use controlled repeated trials|
|Hardware differences|Prediction errors|Record detailed hardware metadata|
|Data leakage|Misleading evaluation|Apply group-based splitting|
|Missing values|Training difficulties|Apply justified preprocessing|
|Thermal variations|Execution-time fluctuations|Record temperature and power conditions|
|Different implementations|Unfair comparison|Validate equivalent computation and measurement boundaries|
|Changing software versions|Performance drift|Record versions and periodically recalibrate|

## 16. Conclusion

The dataset provides the foundation for CoreWise AI's machine learning prediction system.

It combines workload characteristics, hardware specifications, and actual benchmark measurements to help the model learn how different processors execute different types of workloads.

A reliable dataset must be diverse, consistently measured, properly labeled, and free from data leakage.

By maintaining a structured benchmark dataset and continuously validating its quality, CoreWise AI can build more reliable CPU and GPU execution-time prediction models.

---

## Related Notes

- [[ML-Prediction-Model]]
    
- [Feature-Engineering](Feature-Engineering.md.md)
    
- [Algorithms](Algorithms.md.md)
    
- [Model-Training](Model-Training.md.md)
    
- [Model-Evaluation](Model-Evaluation.md.md)
    
- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

## Key Takeaway

**The quality of CoreWise AI's predictions depends heavily on the quality of its benchmark dataset. Accurate workload features, hardware metadata, and consistent CPU/GPU execution-time measurements are essential for reliable processor recommendations.**