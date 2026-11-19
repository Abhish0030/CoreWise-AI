
---

title: Literature Review  
project: CoreWise AI  
domain: Computer Organization and Architecture  
tags:

- research
    
- literature-review
    
- CPU-GPU
    
- machine-learning  
    status: In Progress
    

---

# Literature Review

## 1. Introduction

Modern computing systems increasingly use heterogeneous computing architectures consisting of Central Processing Units (CPUs) and Graphics Processing Units (GPUs). These processors have different architectural characteristics and computational capabilities.

CPUs are designed for general-purpose processing, complex control operations, and sequential execution, whereas GPUs provide massive parallel processing capabilities for computationally intensive workloads.

Selecting the appropriate processing unit for a computational task is an important challenge in achieving better execution performance and resource utilization.

The research community has explored different approaches involving workload characterization, machine learning-based performance prediction, hardware profiling, and intelligent resource scheduling.

This literature review examines three research papers that provide the theoretical and technical foundation for CoreWise AI.

---

## 2. Research Paper 01: Cross-Architecture Performance Prediction (XAPP) Using CPU Code to Predict GPU Performance

**Authors:** Newsha Ardalani, Clint Lestourgeon, Karthikeyan Sankaralingam, Xiaojin Zhu.

**Institution:** University of Wisconsin-Madison.

**Publication:** MICRO-48, 2015.

### Research Objective

The research introduces Cross-Architecture Performance Prediction (XAPP), a machine learning-based technique that estimates GPU execution performance using characteristics extracted from CPU implementations.

The main objective is to predict whether a program can benefit from GPU execution before investing time in developing an optimized GPU implementation.

### Proposed Methodology

The XAPP framework follows a machine learning-based performance prediction approach.

Its workflow consists of:

1. Collecting CPU program characteristics.
    
2. Extracting quantitative workload features.
    
3. Using previously measured GPU execution times as training targets.
    
4. Training regression-based machine learning models.
    
5. Predicting GPU execution time for new workloads.
    
6. Estimating potential GPU speedup using measured CPU execution time.
    

The paper introduces an adaptive two-level machine learning technique using regression learners and ensemble prediction.

### Important Technical Concepts

The paper identifies several features influencing GPU performance:

- Instruction-level parallelism.
    
- Memory access patterns.
    
- Cache effectiveness.
    
- Branch divergence.
    
- Memory coalescing.
    
- Shared memory bank conflicts.
    
- Arithmetic operation distribution.
    
- Working-set size.
    

The study demonstrates that workload characteristics can be used to estimate GPU performance.

### Experimental Findings

The authors evaluated their approach using 24 real-world computational kernels.

Reported average prediction errors:

- Maxwell GPU: 26.9%.
    
- Kepler GPU: 36.0%.
    

These results demonstrate the possibility of predicting GPU performance using machine learning and program characteristics.

### Relevance to CoreWise AI

This research provides the primary foundation for our machine learning prediction engine.

We can adapt its methodology to:

- Extract workload characteristics.
    
- Train regression models.
    
- Estimate CPU and GPU execution times.
    
- Predict performance differences.
    
- Recommend a suitable processing unit.
    

**Our proposed extension:** Instead of predicting only GPU execution time, CoreWise AI will aim to estimate execution times for both CPU and GPU and compare the predictions.

---

## 3. Research Paper 02: Modeling GPU-CPU Workloads and Systems

**Authors:** Andrew Kerr, Gregory Diamos, Sudhakar Yalamanchili.

**Institution:** Georgia Institute of Technology.

**Publication:** GPGPU-3, 2010.

### Research Objective

This research investigates the relationship between application characteristics, processor architecture, and computational performance in heterogeneous CPU-GPU systems.

The study aims to develop predictive models that help identify which processor architecture is more suitable for a particular computational workload.

### Proposed Methodology

The researchers evaluated:

- 25 CUDA applications.
    
- Four GPU architectures.
    
- Three CPU architectures.
    
- 37 application and hardware-related metrics.
    

The study used Ocelot infrastructure to execute and instrument CUDA applications across heterogeneous processors.

Statistical analysis was applied to identify relationships between workload characteristics and processor performance.

### Important Technical Concepts

The paper investigates:

**1. Principal Component Analysis (PCA)**

PCA reduces the dimensionality of workload and hardware metrics by identifying important independent components.

**2. Application Characterization**

The research studies different workload characteristics, including:

- Memory access behavior.
    
- Instruction distribution.
    
- Parallelism.
    
- Computational intensity.
    
- Synchronization.
    
- Thread execution patterns.
    

**3. Hardware Characterization**

It examines:

- Processor clock frequency.
    
- Number of cores.
    
- Hardware threads.
    
- Memory controllers.
    
- Memory bandwidth.
    
- Cache characteristics.
    

### Experimental Findings

The research identifies important relationships between processor architecture and application performance.

One significant observation is that CPUs generally provide stronger individual-core performance, while GPUs provide a larger number of processing cores and higher parallel execution potential.

The paper also demonstrates that statistical modeling can identify relationships between workload characteristics and execution performance.

### Relevance to CoreWise AI

This paper provides the foundation for our workload feature-engineering and hardware-characterization modules.

We can use its ideas to identify important input features for our prediction model.

Potential features include:

- Input size.
    
- Operation count.
    
- Memory requirements.
    
- Parallelism.
    
- Memory bandwidth.
    
- Cache behavior.
    
- Hardware configuration.
    

**Our proposed extension:** Apply workload characterization and dimensionality reduction to identify the most important features influencing CPU-GPU execution-time predictions.

---

## 4. Research Paper 03: Scheduling CPU for GPU-Based Deep Learning Jobs

**Authors:** Wencong Xiao, Zhenhua Han, Hanyu Zhao, Xuan Peng, Quanlu Zhang, Fan Yang, Lidong Zhou.

**Publication:** ACM Symposium on Cloud Computing (SoCC), 2018.

### Research Objective

This research investigates CPU resource allocation challenges in GPU-based deep learning environments.

It highlights that GPU performance does not depend only on GPU resources. CPU resources are also important for data preprocessing, workload preparation, and coordinating GPU execution.

### Proposed Methodology

The research introduces SAD, a scheduling approach designed to improve CPU resource allocation for GPU-based deep learning jobs.

Its methodology includes:

1. Lightweight workload profiling.
    
2. Continuous resource monitoring.
    
3. Identification of CPU demand variations.
    
4. Performance prediction for different CPU allocations.
    
5. Adaptive CPU resource scheduling.
    

### Important Technical Concepts

**1. Workload Heterogeneity**

Different computational workloads require different amounts of CPU resources.

**2. CPU-GPU Coordination**

CPU operations such as data preprocessing can overlap with GPU operations such as neural network computation.

**3. Dynamic Resource Demand**

CPU requirements can change during different stages of deep learning workloads.

**4. Performance Monitoring**

Continuous monitoring helps identify resource bottlenecks and improve allocation decisions.

### Experimental Findings

The paper reports that:

- Overfeat and ResNet50 exhibit significantly different CPU requirements.
    
- Better GPU allocation can increase the importance of CPU resources.
    
- Neural machine translation workloads exhibit changing CPU and GPU utilization during training and validation.
    

The authors report a 19% improvement in overall utilization and a 34% reduction in job completion time compared with workload-agnostic allocation in their preliminary trace evaluation.

### Relevance to CoreWise AI

This research provides useful insights for our workload analysis and resource optimization modules.

We can incorporate:

- CPU utilization.
    
- GPU utilization.
    
- Workload characteristics.
    
- Resource demand.
    
- Execution-stage information.
    
- Hardware availability.
    

**Our proposed extension:** Develop an intelligent recommendation system that considers processor performance and resource availability rather than relying exclusively on workload type.

---

## 5. Comparative Analysis

|Research Paper|Main Contribution|Technique|Application in CoreWise AI|
|---|---|---|---|
|XAPP (2015)|Predicting GPU performance using CPU code|Machine Learning, Regression, Ensemble Models|Execution-time prediction|
|Modeling GPU-CPU Workloads (2010)|Characterizing workload and hardware behavior|PCA, Statistical Analysis, Regression|Feature engineering|
|Scheduling CPU for GPU-based DL Jobs (2018)|Adaptive CPU resource allocation|Profiling, Monitoring, Performance Prediction|Resource optimization|

---

## 6. Overall Research Insights

The three research papers establish that CPU-GPU performance depends on multiple factors rather than simply the number of processor cores.

Important factors include:

1. Workload computational complexity.
    
2. Degree of parallelism.
    
3. Memory access patterns.
    
4. Memory bandwidth.
    
5. Hardware architecture.
    
6. CPU-GPU communication overhead.
    
7. Resource utilization.
    
8. Dynamic workload behavior.
    

The findings suggest that workload characterization, performance modeling, and resource-aware prediction should be considered together.

## 7. Research Foundation for CoreWise AI

Based on these studies, CoreWise AI proposes an integrated system containing:

- Workload Analysis Engine.
    
- Machine Learning Prediction Engine.
    
- CPU-GPU Performance Comparison.
    
- Benchmarking Module.
    
- Agentic AI Recommendation Engine.
    
- Interactive Performance Dashboard.
    

The proposed system aims to combine workload characterization, execution-time prediction, and intelligent recommendation into a unified application.