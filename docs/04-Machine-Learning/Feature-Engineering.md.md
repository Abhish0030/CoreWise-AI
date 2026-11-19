# Feature Engineering

## 1. Introduction

Feature Engineering is the process of transforming raw data into meaningful input variables that help a Machine Learning model identify patterns and make accurate predictions.

In CoreWise AI, feature engineering plays an important role because CPU and GPU performance depends on several factors, including workload size, computational complexity, parallelism, memory access patterns, and hardware capabilities.

Raw information such as processor specifications and workload descriptions cannot always be directly used by a machine learning algorithm. Therefore, this information must be converted into structured numerical features.

The main objective is to create a feature vector that represents both the workload and the hardware on which it will execute.

X=[x1,x2,x3,…,xn]X=[x_1,x_2,x_3,\ldots,x_n]

Where:

- XX represents the input feature vector.
    
- xix_i represents an individual feature.
    
- nn represents the total number of selected features.
    

The ML model uses this feature vector to predict execution time.

T^=fθ(X)\hat{T}=f_{\theta}(X)

Where:

- T^\hat{T} = predicted execution time.
    
- fθf_{\theta} = trained prediction model.
    
- XX = engineered input features.
    

---

## 2. Feature Engineering Pipeline

CoreWise AI follows a structured feature engineering process.

```text
       Raw Workload Data
               |
               v
       Hardware Information
               |
               v
        Data Extraction
               |
               v
       Feature Identification
               |
               v
       Numerical Conversion
               |
               v
       Feature Transformation
               |
               v
       Feature Selection
               |
               v
       Feature Normalization
               |
               v
       Final Feature Vector
               |
               v
       ML Prediction Model
```

### Main stages

1. Data extraction: collect workload and hardware information.
    
2. Feature identification: identify variables that influence execution time.
    
3. Numerical conversion: convert categorical information into numerical representations.
    
4. Feature transformation: calculate derived mathematical features.
    
5. Feature selection: retain useful features and remove irrelevant ones.
    
6. Normalization: scale numerical values when required.
    
7. Feature vector generation: prepare the final model input.
    

---

## 3. Workload-Based Features

Workload features describe the computational task that needs to be executed.

### 3.1 Input Size

Input size represents the amount of data processed by the workload.

For example, in matrix multiplication:

Am×n×Bn×p=Cm×pA_{m\times n}\times B_{n\times p}=C_{m\times p}

The number of elements in the input matrices is:

Ninput=mn+npN_{input}=mn+np

The output matrix contains:

Noutput=mpN_{output}=mp

For square matrix multiplication of dimension NN:

Ninput=2N2N_{input}=2N^2 Noutput=N2N_{output}=N^2

Larger input sizes generally increase the computational and memory requirements.

**Importance:** Helps the model understand workload scale.

### 3.2 Operation Count

Operation count represents the approximate number of computational operations performed.

For square matrix multiplication:

AN×N×BN×NA_{N\times N}\times B_{N\times N}

The approximate floating-point operation count is:

FLOPs=2N3FLOPs=2N^3

For example, if:

N=1024N=1024

Then:

FLOPs=2(1024)3FLOPs=2(1024)^3 FLOPs=2,147,483,648FLOPs=2,147,483,648

This represents approximately 2.15 billion floating-point operations.

**Importance:** Helps identify computationally intensive workloads.

### 3.3 Parallelizable Fraction

Parallelizable fraction represents the proportion of a workload that can execute simultaneously.

Let:

- PP = parallelizable fraction.
    
- 1−P1-P = sequential fraction.
    

For example:

P=0.90P=0.90

This means approximately 90% of the workload can potentially be parallelized.

A high parallelizable fraction may indicate an opportunity for GPU acceleration.

However, parallelism alone does not guarantee better GPU performance because memory transfer and launch overhead also matter.

**Importance:** Helps estimate whether the workload can benefit from parallel processing.

### 3.4 Workload Type

Workloads can be categorized into different groups:

|Workload Type|Characteristics|Example|
|---|---|---|
|Compute-intensive|High computational demand|Matrix multiplication|
|Memory-intensive|Frequent memory access|Large array processing|
|Sequential|Strong execution dependencies|Sequential algorithms|
|Parallel|Independent operations|Image processing|
|Data-intensive|Large data movement|Data transformation|

Since workload type is categorical, it must be converted into a numerical representation before being supplied to many ML models.

---

## 4. Hardware-Based Features

Hardware features describe the capabilities of the processor.

### 4.1 CPU Core Count

CPU core count represents the number of physical processing cores.

Let:

CCPU=Number of CPU coresC_{CPU}=\text{Number of CPU cores}

A CPU with more cores may execute parallel tasks more efficiently, depending on workload parallelism and resource limitations.

### 4.2 CPU Clock Frequency

Clock frequency represents the number of clock cycles performed per second.

F=Clock FrequencyF=\text{Clock Frequency}

A simplified CPU execution-time relationship is:

TCPU=IC×CPIFT_{CPU}=\frac{IC\times CPI}{F}

Where:

- ICIC = instruction count.
    
- CPICPI = average cycles per instruction.
    
- FF = clock frequency.
    

This equation provides a simplified theoretical relationship. Actual performance also depends on caching, memory stalls, instruction-level parallelism, and other architectural factors.

### 4.3 GPU Streaming Multiprocessor Count

Streaming Multiprocessors (SMs) are major processing units in NVIDIA GPU architectures.

Let:

SM=Number of Streaming MultiprocessorsSM=\text{Number of Streaming Multiprocessors}

A higher SM count can provide greater parallel processing capacity, but actual performance also depends on workload distribution, occupancy, memory behavior, and hardware architecture.

### 4.4 Memory Bandwidth

Memory bandwidth measures how much data can be transferred per unit of time.

BW=DataTransferredTransferTimeBW=\frac{DataTransferred}{TransferTime}

For example, if 20 GB of data is transferred in 0.05 seconds:

BW=200.05BW=\frac{20}{0.05} BW=400 GB/sBW=400\ GB/s

**Importance:** Helps identify memory-intensive workloads and potential bandwidth limitations.

### 4.5 Memory Capacity

Memory capacity describes the amount of memory available to the processor.

For a GPU, available VRAM is especially important because workloads that exceed available device memory may require additional transfers or may fail to execute.

**Importance:** Helps determine whether the workload can fit within available processor memory.

---

## 5. Derived Mathematical Features

Derived features are calculated using existing raw features.

They often provide more useful information than individual hardware specifications.

### 5.1 Arithmetic Intensity

Arithmetic intensity measures the amount of computation performed per byte of data transferred.

AI=FLOPsBytesTransferredAI=\frac{FLOPs}{BytesTransferred}

Where:

- FLOPs = number of floating-point operations.
    
- BytesTransferred = bytes transferred from memory.
    

Example:

Suppose a workload performs:

FLOPs=109FLOPs=10^9

And transfers:

BytesTransferred=108BytesTransferred=10^8

Then:

AI=109108=10AI=\frac{10^9}{10^8}=10

The arithmetic intensity is 10 FLOPs per byte.

Interpretation:

- High arithmetic intensity: relatively more computation per byte transferred.
    
- Low arithmetic intensity: relatively more data movement per computation.
    

This feature helps the model understand whether a workload may be compute-bound or memory-bound.

### 5.2 Computational Density

Computational density can represent the amount of computation relative to input data size.

CD=FLOPsInputSizeCD=\frac{FLOPs}{InputSize}

The unit depends on how input size is represented.

For example, if a workload performs 1,000,000 operations on 10,000 input elements:

CD=1,000,00010,000=100CD=\frac{1,000,000}{10,000}=100

This means 100 operations per input element.

### 5.3 CPU-to-GPU Memory Bandwidth Ratio

A useful hardware comparison feature is:

RBW=BWGPUBWCPUR_{BW}=\frac{BW_{GPU}}{BW_{CPU}}

For example:

BWGPU=400 GB/sBW_{GPU}=400\ GB/s BWCPU=80 GB/sBW_{CPU}=80\ GB/s

Therefore:

RBW=40080=5R_{BW}=\frac{400}{80}=5

The GPU has five times the stated memory bandwidth in this example.

This ratio alone cannot establish which processor will be faster because cache behavior, memory access patterns, and transfer overhead also influence performance.

### 5.4 Estimated Parallel Work

Parallel work can be estimated from the total operation count and parallelizable fraction.

WP=P×WW_P=P\times W

Where:

- WW = total operation count.
    
- PP = parallelizable fraction.
    
- WPW_P = estimated parallel operation count.
    

If:

W=109,P=0.8W=10^9,\quad P=0.8

Then:

WP=0.8×109W_P=0.8\times10^9

Approximately 800 million operations belong to the parallelizable portion.

### 5.5 Data Transfer Volume

For GPU workloads, data transfer volume is an important feature.

Dtotal=DH2D+DD2HD_{total}=D_{H2D}+D_{D2H}

Where:

- DH2DD_{H2D} = host-to-device data volume.
    
- DD2HD_{D2H} = device-to-host data volume.
    

A large transfer volume may reduce the performance advantage of GPU execution.

---

## 6. Memory Access Pattern Features

Memory access patterns influence how efficiently processors retrieve data.

Important categories include:

### Sequential Access

Memory locations are accessed in an ordered sequence.

This can improve cache utilization and memory coalescing when the access pattern is suitable.

### Random Access

Memory locations are accessed unpredictably.

This may reduce cache efficiency and increase memory access latency.

### Strided Access

Memory locations are accessed with a fixed interval between consecutive accesses.

For example:

A[0],A[2],A[4],A[6]A[0],A[2],A[4],A[6]

The stride is 2.

### Coalesced Access

In GPU programming, coalesced memory access allows threads in a warp to access nearby memory locations efficiently.

A poor access pattern can increase the number of memory transactions.

**CoreWise AI application:** Memory access patterns can be encoded as categorical features to help the prediction model distinguish workloads with different memory behavior.

---

## 7. Feature Encoding

Machine learning algorithms require numerical input. Therefore, categorical features must be converted into numerical representations.

### 7.1 Label Encoding

Label encoding assigns a numerical value to each category.

Example:

|Workload Type|Encoded Value|
|---|--:|
|Compute-intensive|0|
|Memory-intensive|1|
|Sequential|2|
|Parallel|3|

This approach is simple, but it may incorrectly imply an ordering between categories.

### 7.2 One-Hot Encoding

One-hot encoding creates a separate binary feature for each category.

Example:

|Workload Type|Compute|Memory|Sequential|Parallel|
|---|--:|--:|--:|--:|
|Compute-intensive|1|0|0|0|
|Memory-intensive|0|1|0|0|
|Sequential|0|0|1|0|
|Parallel|0|0|0|1|

This avoids introducing an artificial numerical ordering.

One-hot encoding can be useful for workload categories and processor types.

### 7.3 Hardware Model Encoding

Hardware model names may contain many unique values.

Possible approaches include:

- One-hot encoding for a limited number of hardware models.
    
- Manufacturer and architecture categories.
    
- Numerical hardware specifications.
    
- Learned embeddings when using suitable neural network architectures.
    

Hardware identifiers should not be treated as meaningful numerical magnitudes.

---

## 8. Feature Scaling and Normalization

Different features may have different numerical ranges.

For example:

|Feature|Example Range|
|---|---|
|Input size|100–100000|
|Clock frequency|1–5 GHz|
|Parallel fraction|0–1|
|Memory bandwidth|10–1000 GB/s|

Features with large numerical values may dominate some algorithms.

Scaling can help improve model training.

### 8.1 Min-Max Normalization

Min-Max normalization transforms values into a range, usually between 0 and 1.

X′=X−XminXmax−XminX'=\frac{X-X_{min}}{X_{max}-X_{min}}

Example:

Suppose:

X=50,Xmin=10,Xmax=90X=50,\quad X_{min}=10,\quad X_{max}=90

Then:

X′=50−1090−10X'=\frac{50-10}{90-10} X′=0.5X'=0.5

### 8.2 Standardization

Standardization transforms a feature so that it has approximately zero mean and unit standard deviation.

Z=X−μσZ=\frac{X-\mu}{\sigma}

Where:

- XX = original value.
    
- μ\mu = mean of the training data.
    
- σ\sigma = standard deviation of the training data.
    

### Important Rule

Scaling parameters must be calculated using training data only.

The same parameters must then be applied to validation, test, and production inputs.

This prevents information from the test dataset from influencing training.

Tree-based models such as Random Forest and XGBoost generally do not require standardization, although consistent preprocessing may still be useful for a shared pipeline.

---

## 9. Feature Selection

Not every feature contributes equally to prediction accuracy.

Feature selection identifies the most useful variables while removing irrelevant or redundant information.

### 9.1 Correlation Analysis

Correlation measures the relationship between two numerical variables.

Pearson correlation is:

r=∑i=1N(Xi−Xˉ)(Yi−Yˉ)∑i=1N(Xi−Xˉ)2∑i=1N(Yi−Yˉ)2r=\frac{\sum_{i=1}^{N}(X_i-\bar{X})(Y_i-\bar{Y})} {\sqrt{\sum_{i=1}^{N}(X_i-\bar{X})^2} \sqrt{\sum_{i=1}^{N}(Y_i-\bar{Y})^2}}

The value ranges from -1 to +1.

- r=+1r=+1: perfect positive linear correlation.
    
- r=−1r=-1: perfect negative linear correlation.
    
- r=0r=0: no linear correlation.
    

Correlation does not establish causation and may fail to capture nonlinear relationships.

### 9.2 Feature Importance

Tree-based algorithms can estimate the importance of different features.

For example, a model may indicate that:

- Input size is highly useful.
    
- Arithmetic intensity is highly useful.
    
- Memory bandwidth is useful.
    
- Workload type is useful.
    
- Some redundant hardware features contribute little.
    

Feature importance should be interpreted carefully because correlated features can divide or distort importance scores.

### 9.3 Recursive Feature Elimination

Recursive Feature Elimination (RFE) repeatedly trains a model and removes less important features.

The process continues until a selected number of features remains.

This can help identify a smaller feature set without unnecessarily increasing model complexity.

---

## 10. Recommended Feature Vector for CoreWise AI

An initial feature vector may contain:

X=[InputSize,OperationCount,ParallelFraction,ArithmeticIntensity,MemoryBandwidth,DataTransferVolume,CPUCoreCount,CPUFrequency,GPUSMCount,GPUFrequency,VRAMCapacity,WorkloadType]X=[ InputSize, OperationCount, ParallelFraction, ArithmeticIntensity, MemoryBandwidth, DataTransferVolume, CPUCoreCount, CPUFrequency, GPU_SMCount, GPUFrequency, VRAMCapacity, WorkloadType ]

A more complete implementation can include:

- Cache sizes.
    
- Memory latency estimates.
    
- GPU architecture.
    
- Compiler and library versions.
    
- Kernel launch configuration.
    
- Grid and block dimensions.
    
- Shared memory usage.
    
- Register usage.
    
- Data dependency information.
    

The exact feature set should be selected according to the workloads, hardware, and benchmark data available.

### Important Design Decision

For CPU prediction, the model should receive CPU-relevant hardware features.

For GPU prediction, the model should receive GPU-relevant hardware features.

A unified model may use a shared feature schema with processor-specific fields and a processor-type indicator.

---

## 11. Example Feature Engineering Calculation

Consider a matrix multiplication workload.

Given:

- Matrix size: N=512N=512.
    
- Approximate floating-point operations: 2N32N^3.
    
- Total transferred data: 6 MB.
    
- Parallelizable fraction: 0.90.
    

### Step 1: Calculate Operation Count

FLOPs=2(512)3FLOPs=2(512)^3 FLOPs=268,435,456FLOPs=268,435,456

### Step 2: Calculate Arithmetic Intensity

Convert 6 MB into bytes.

Using decimal MB:

BytesTransferred=6,000,000BytesTransferred=6,000,000

Therefore:

AI=268,435,4566,000,000AI=\frac{268,435,456}{6,000,000} AI≈44.74 FLOPs/ByteAI\approx44.74\ FLOPs/Byte

### Step 3: Calculate Parallel Work

WP=P×WW_P=P\times W WP=0.90×268,435,456W_P=0.90\times268,435,456 WP≈241,591,910W_P\approx241,591,910

### Step 4: Construct Feature Vector

An illustrative feature vector is:

X=[512,268435456,0.90,44.74,6,ComputeIntensive]X=[ 512, 268435456, 0.90, 44.74, 6, ComputeIntensive ]

The categorical workload type must be encoded numerically before passing this vector to the model.

This final feature representation can be supplied to the CPU and GPU prediction models with their corresponding hardware features.

_This example demonstrates feature calculation, not a measured prediction result._

---

## 12. Feature Engineering Using Python

The following example demonstrates basic feature generation using Python and Pandas.

```python
import pandas as pd
import numpy as np

data = {
    "matrix_size": [256, 512, 1024],
    "parallel_fraction": [0.85, 0.90, 0.95],
    "data_transfer_mb": [2, 6, 20]
}

df = pd.DataFrame(data)

# Calculate approximate FLOPs for square matrix multiplication
df["operation_count"] = 2 * (df["matrix_size"] ** 3)

# Convert MB to bytes using decimal units
df["data_transfer_bytes"] = (
    df["data_transfer_mb"] * 1_000_000
)

# Calculate arithmetic intensity
df["arithmetic_intensity"] = (
    df["operation_count"] / df["data_transfer_bytes"]
)

# Calculate estimated parallel operation count
df["parallel_operations"] = (
    df["operation_count"] * df["parallel_fraction"]
)

print(df)
```

This example creates derived features from raw workload information.

In a real implementation, the transferred-byte measurement must be based on the actual memory traffic or a clearly defined estimation method.

---

## 13. Avoiding Data Leakage

Data leakage occurs when information that would not be available during prediction is used to train the model.

For CoreWise AI, this is particularly important.

Suppose the goal is to predict GPU execution time before running a workload.

Using actual GPU utilization measured after execution would introduce information from the execution process into the prediction.

This can make evaluation results misleading.

### Prevention Strategies

1. Separate pre-execution features from runtime features.
    
2. Fit scaling and encoding transformations using training data only.
    
3. Avoid including actual execution time as an input feature.
    
4. Split related benchmark records into appropriate groups.
    
5. Keep test data isolated until final evaluation.
    
6. Record the exact feature-generation procedure used during training.
    

Runtime features can be used in a separate online prediction system, but that system should be clearly distinguished from pre-execution prediction.

---

## 14. Feature Engineering Challenges

|Challenge|Impact|Solution|
|---|---|---|
|Different feature scales|Can affect certain algorithms|Apply suitable scaling|
|Missing hardware information|Incomplete representation|Use validated metadata and justified imputation|
|Categorical variables|Cannot always be used directly|Apply encoding|
|Redundant features|Increased complexity|Apply correlation and feature-selection analysis|
|Data leakage|Misleading model evaluation|Separate pre-execution and runtime features|
|Hardware diversity|Difficult generalization|Include diverse hardware configurations|
|Noisy measurements|Unstable derived features|Use repeated benchmark trials|
|Incorrect operation estimates|Misleading computational features|Document calculation assumptions|

---

## 15. Future Improvements

Feature engineering can be improved as CoreWise AI develops.

Potential improvements include:

- Automatic workload feature extraction.
    
- Hardware-aware feature generation.
    
- GPU kernel configuration features.
    
- Memory access pattern analysis.
    
- Runtime telemetry integration.
    
- SHAP-based feature interpretation.
    
- Feature selection through automated experimentation.
    
- Workload-specific feature pipelines.
    
- Power and energy-related features.
    

These features should be introduced only when reliable data collection and validation methods are available.

---

## 16. Conclusion

Feature Engineering converts raw workload and hardware information into meaningful numerical representations for machine learning.

For CoreWise AI, important features include input size, operation count, parallelizable fraction, arithmetic intensity, memory bandwidth, data transfer volume, CPU specifications, and GPU specifications.

Derived mathematical features help the model understand the relationship between computational demand and hardware capabilities.

A carefully designed feature engineering pipeline improves data quality, supports model training, reduces unnecessary complexity, and helps produce more reliable CPU and GPU execution-time predictions.

---

## Related Notes

- [[ML-Prediction-Model]]
    
- [Dataset](Dataset.md.md)
    
- [Model-Training](Model-Training.md.md)
    
- [Model-Evaluation](Model-Evaluation.md.md)
    
- [[Model-Explainability]]
    
- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Parallel-Processing](../02-COA-Concepts/Parallel-Processing.md.md)
    
- [Memory-Hierarchy](../02-COA-Concepts/Memory-Hierarchy.md.md)
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

## Key Takeaway

**Feature Engineering transforms raw workload and hardware data into meaningful mathematical features that allow CoreWise AI to learn performance patterns and predict CPU and GPU execution times.**