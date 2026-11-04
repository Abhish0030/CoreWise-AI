
---

title: Research Gaps and Proposed Innovation  
project: CoreWise AI  
tags:

- research-gap
    
- innovation
    
- CPU-GPU
    

---

# Research Gaps and Proposed Innovation

## 1. Introduction

The reviewed research papers demonstrate significant progress in CPU-GPU performance prediction, workload characterization, and resource scheduling.

However, these studies also reveal opportunities for developing an integrated and user-friendly system that combines performance prediction, workload analysis, and intelligent recommendations.

The following research gaps are identified from the reviewed studies and our proposed project scope.

## 2. Identified Research Gaps

### Gap 1: Integrated CPU-GPU Execution-Time Prediction

**Existing research:**

XAPP primarily focuses on predicting GPU execution time using CPU program characteristics.

The workload modeling study investigates relative performance across different architectures.

**Identified opportunity:**

Develop a unified prediction system that estimates both CPU and GPU execution times for the same workload.

**Our proposed solution:**

CoreWise AI will use machine learning models to estimate execution times for both processing units and compare the results.

### Gap 2: Hardware-Aware Prediction

**Existing research:**

Performance models can depend on specific hardware configurations.

A model trained for one architecture may not generalize accurately to another.

**Identified opportunity:**

Consider processor specifications and hardware configurations as part of the prediction process.

**Our proposed solution:**

Include hardware-related parameters such as:

- CPU core count.
    
- CPU frequency.
    
- GPU architecture.
    
- GPU memory.
    
- Memory bandwidth.
    
- Available processing resources.
    

### Gap 3: Dynamic Workload Characteristics

**Existing research:**

The SAD research demonstrates that CPU demand can change across different stages of deep learning workloads.

Static resource allocation may not be suitable for every workload.

**Identified opportunity:**

Consider changing workload characteristics and resource utilization during execution.

**Our proposed solution:**

Explore workload profiling and resource monitoring to improve recommendation quality.

### Gap 4: Intelligent Explanation of Predictions

**Existing research:**

The reviewed performance-prediction approaches primarily focus on modeling and resource allocation.

**Identified opportunity:**

Provide understandable explanations of why a CPU or GPU is recommended.

**Our proposed solution:**

Integrate an Agentic AI component that interprets model predictions and explains:

- Why a particular processor is recommended.
    
- Which workload characteristics influence the prediction.
    
- What performance bottlenecks may exist.
    
- When additional benchmarking is necessary.
    

### Gap 5: Prediction and Actual Performance Validation

**Existing research:**

The reviewed studies use experimental measurements and performance evaluation to validate their approaches.

**Identified opportunity:**

Provide an interactive environment that directly compares predicted performance with measured performance.

**Our proposed solution:**

Develop a benchmarking module that compares:

- Predicted CPU execution time.
    
- Actual CPU execution time.
    
- Predicted GPU execution time.
    
- Actual GPU execution time.
    

This will help evaluate model reliability.

### Gap 6: User-Friendly Performance Analysis

**Existing research:**

Research frameworks often require specialized programming knowledge and benchmarking environments.

**Identified opportunity:**

Make CPU-GPU performance prediction accessible through a simple interface.

**Our proposed solution:**

Build a web dashboard where users can submit workload information and visualize predictions, comparisons, and AI-generated explanations.

---

## 3. Proposed Innovation in CoreWise AI

Our project proposes combining the following capabilities:

|Component|Proposed Contribution|
|---|---|
|Workload Analysis|Identify computational characteristics|
|ML Prediction|Estimate CPU and GPU execution times|
|Hardware Awareness|Consider processor configurations|
|Performance Comparison|Compare predicted execution times|
|Agentic AI|Explain predictions and recommendations|
|Benchmarking|Validate predictions using measurements|
|Dashboard|Visualize workload performance|

## 4. Proposed Research Contribution

The proposed contribution of CoreWise AI is an integrated prototype that combines machine learning-based execution-time prediction, workload characterization, hardware-aware analysis, and Agentic AI-assisted recommendations.

Unlike a basic CPU-GPU classifier, the proposed system aims to estimate performance on both processors and explain the recommendation using workload and hardware characteristics.

## 5. Research Limitations to Consider

The proposed system will face several challenges:

1. Availability of reliable CPU-GPU benchmark datasets.
    
2. Hardware-dependent model performance.
    
3. Data-transfer overhead between CPU and GPU.
    
4. Differences in workload implementation.
    
5. Limited generalization across hardware configurations.
    
6. Accuracy of predicted execution times.
    
7. Resource utilization variations during execution.
    

These limitations will be considered during implementation and evaluation.

## 6. Expected Outcome

CoreWise AI aims to provide a machine learning-based system that analyzes computational workloads, estimates CPU-GPU execution performance, and recommends an appropriate processing unit with an understandable explanation.

**Important:** These are proposed contributions and research opportunities, not claims that the reviewed papers have never addressed any of these ideas independently.