# Overall System Architecture — CoreWise AI

## 1. Introduction

CoreWise AI is an AI-powered computational performance analysis platform designed to predict and compare CPU and GPU execution performance for different computational workloads.

The system combines machine learning, hardware information, benchmarking, and agentic AI to help users identify the most suitable processing device for a particular workload.

Instead of relying only on theoretical hardware specifications, CoreWise AI aims to analyze workload characteristics, consider hardware capabilities, predict execution times, and generate performance recommendations.

The application follows a modular architecture in which different components perform specialized responsibilities while communicating through well-defined interfaces.

### Main objectives

- Analyze computational workloads.
    
- Identify available CPU and GPU hardware.
    
- Extract workload and hardware features.
    
- Predict CPU execution time using ML models.
    
- Predict GPU execution time using ML models.
    
- Compare predicted execution performance.
    
- Execute actual benchmarks where supported.
    
- Recommend suitable processing hardware.
    
- Explain predictions using explainability techniques.
    
- Provide natural-language explanations through agentic AI.
    
- Store historical workload and performance information.
    

---

## 2. Overall Technology Stack

The following technology stack is proposed for CoreWise AI.

|Layer|Technology|Purpose|
|---|---|---|
|Frontend Framework|Next.js|Web application development|
|Frontend Language|TypeScript|Type-safe frontend development|
|Package Manager|pnpm|Dependency management|
|Styling|Tailwind CSS|Responsive interface design|
|UI Components|ShadCN UI|Reusable components|
|Icons|Lucide React|Interface icons|
|Charts|Recharts|Performance visualization|
|Backend Runtime|Node.js|Backend execution|
|Backend Framework|Express.js|REST API development|
|Backend Language|TypeScript|Backend implementation|
|ML Language|Python|ML model development and inference|
|ML Framework|Scikit-learn / XGBoost|Performance prediction|
|Agent Framework|LangGraph|Agent workflow orchestration|
|LLM Provider|To be finalized|Natural-language reasoning|
|Database|PostgreSQL|Structured data persistence|
|Vector Extension|pgvector|Vector similarity search|
|ORM|Prisma|Database operations|
|Explainability|SHAP|ML prediction interpretation|
|Validation|Zod / Pydantic|Input validation|
|Deployment|Vercel + suitable backend hosting|Application hosting|

The LLM provider and hosting configuration should be finalized according to implementation requirements and available resources.

---

## 3. High-Level System Architecture

CoreWise AI follows a modular, multi-layer architecture.

The major layers are:

1. Presentation Layer.
    
2. API and Application Layer.
    
3. Workload Analysis Layer.
    
4. Hardware Detection Layer.
    
5. Machine Learning Layer.
    
6. Benchmarking Layer.
    
7. Agentic AI Layer.
    
8. Data and Knowledge Layer.
    

### High-level architecture diagram

```text
+------------------------------------------------------+
|                    USER                              |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                 PRESENTATION LAYER                   |
|                                                      |
|                   Next.js + TypeScript               |
|                                                      |
|  Home | Dashboard | Workload | Compare | Reports     |
|  CPU Analysis | GPU Analysis | Benchmarking           |
+--------------------------+---------------------------+
                           |
                           | REST API
                           v
+------------------------------------------------------+
|                API AND APPLICATION LAYER             |
|                                                      |
|                   Node.js + Express.js               |
|                                                      |
|  Authentication | Workload API | Hardware API        |
|  Prediction API | Benchmark API | Report API         |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                WORKLOAD ANALYSIS LAYER                |
|                                                      |
|  Input Validation                                    |
|  Workload Classification                             |
|  Feature Extraction                                  |
|  Feature Normalization                               |
|  Workload Metadata                                   |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                HARDWARE DETECTION LAYER               |
|                                                      |
|  CPU Specifications                                  |
|  GPU Specifications                                  |
|  Memory Information                                  |
|  Hardware Capabilities                               |
|  Resource Availability                               |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|              MACHINE LEARNING LAYER                  |
|                                                      |
|             Python + Scikit-learn / XGBoost          |
|                                                      |
|       +----------------+  +----------------+          |
|       | CPU Prediction |  | GPU Prediction |          |
|       | Model          |  | Model          |          |
|       +----------------+  +----------------+          |
|                                                      |
|             Execution-Time Predictions               |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                PERFORMANCE ENGINE                    |
|                                                      |
|  CPU/GPU Comparison                                  |
|  Speedup Calculation                                 |
|  Performance Metrics                                 |
|  Recommendation Generation                           |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                 AGENTIC AI LAYER                     |
|                                                      |
|                    LangGraph                         |
|                                                      |
|  Tool Calling | Workflow Coordination               |
|  Explainability | RAG | Natural Language Response    |
+--------------------------+---------------------------+
                           |
                           v
+------------------------------------------------------+
|                  DATA LAYER                          |
|                                                      |
|              PostgreSQL + pgvector                  |
|                                                      |
|  Users | Workloads | Hardware | Predictions          |
|  Benchmarks | Reports | Embeddings | Documents        |
+------------------------------------------------------+
```

**Architecture note:** This diagram represents the proposed logical architecture. The actual deployment may distribute these components across separate processes or cloud services.

---

## 4. Presentation Layer — Next.js Frontend

The presentation layer provides the interface through which users interact with CoreWise AI.

It will be developed using Next.js, TypeScript, Tailwind CSS, and ShadCN UI.

### Main responsibilities

- Display the home page.
    
- Provide workload submission forms.
    
- Display detected hardware specifications.
    
- Show CPU/GPU prediction results.
    
- Visualize performance comparisons.
    
- Display benchmarking results.
    
- Present AI-generated explanations.
    
- Maintain user profiles and analysis history.
    

### Main frontend modules

|Module|Responsibility|
|---|---|
|Home|Introduce CoreWise AI|
|Dashboard|Display performance overview|
|Workload Analysis|Accept workload inputs|
|CPU Analysis|Display CPU information and predictions|
|GPU Analysis|Display GPU information and predictions|
|Performance Comparison|Compare CPU and GPU|
|Benchmarking|Run and review benchmarks|
|Reports|Display historical analysis|
|Profile|Manage user information|

### Frontend architecture

```text
              NEXT.JS APPLICATION
                       |
          +------------+------------+
          |            |            |
          v            v            v
        Pages      Components     Services
          |            |            |
          v            v            v
       Layouts       UI Cards     Axios Client
          |            |            |
          +------------+------------+
                       |
                       v
                 EXPRESS API
```

The frontend should not directly connect to PostgreSQL or access private ML model credentials.

Related note: [Frontend](Frontend.md.md)

---

## 5. API and Application Layer — Node.js + Express.js

The API layer connects the frontend with the backend processing services.

It receives HTTP requests, validates inputs, invokes services, and returns structured JSON responses.

### Main responsibilities

- API request handling.
    
- Authentication and authorization.
    
- Workload request processing.
    
- Hardware information retrieval.
    
- ML service communication.
    
- Benchmark execution coordination.
    
- Recommendation generation.
    
- Report management.
    
- Database operations.
    

### API modules

|API Module|Purpose|
|---|---|
|Authentication API|Manage user access|
|Workload API|Submit and retrieve workloads|
|Hardware API|Retrieve hardware profiles|
|Prediction API|Request CPU/GPU predictions|
|Benchmark API|Manage benchmark jobs|
|Recommendation API|Generate hardware recommendations|
|Explainability API|Retrieve prediction explanations|
|Report API|Manage analysis reports|

### Communication flow

```text
Next.js Frontend
       |
       v
Express.js API
       |
       v
Authentication Middleware
       |
       v
Request Validation
       |
       v
Controller
       |
       v
Service Layer
       |
       +----------+-----------+
       |          |           |
       v          v           v
      ML       Database    Agent Service
    Service
```

Related note: [Backend](Backend.md.md)

---

## 6. Workload Analysis Layer

The workload analysis layer converts user input into structured computational features.

These features are important because CPU and GPU performance depend on the characteristics of the workload, not just the hardware specifications.

### Input information

A workload may contain:

- Workload type.
    
- Input dimensions.
    
- Data type.
    
- Operation count.
    
- Memory requirements.
    
- Computational dependencies.
    
- Parallelism characteristics.
    
- Memory access patterns.
    

### Feature extraction

The workload analyzer may extract features such as:

|Feature|Description|
|---|---|
|Input Size|Size of the input data|
|Operation Count|Estimated number of computational operations|
|Parallelism Level|Degree of available parallel execution|
|Arithmetic Intensity|Floating-point operations per byte transferred|
|Memory Transfer Volume|Amount of data moved|
|Data Type|Float32, Float64, Int32, etc.|
|Dependency Level|Dependencies between operations|
|Workload Category|Type of computational task|

### Processing workflow

```text
User Input
    |
    v
Input Validation
    |
    v
Workload Identification
    |
    v
Feature Extraction
    |
    v
Feature Transformation
    |
    v
Structured Feature Vector
    |
    v
ML Prediction Models
```

### Example feature representation

```json
{
  "workload_type": "matrix_multiplication",
  "input_size": 1000000,
  "operation_count": 2000000000,
  "parallelism_level": 0.85,
  "data_type": "float32"
}
```

The values are illustrative and should be calculated according to the actual workload definition.

Related notes:

- [Feature-Engineering](../04-Machine-Learning/Feature-Engineering.md.md)
    
- [Dataset](../04-Machine-Learning/Dataset.md.md)
    

---

## 7. Hardware Detection Layer

The hardware detection layer identifies the processing hardware available for analysis.

### CPU information

- Processor model.
    
- Physical cores.
    
- Logical threads.
    
- Clock frequency.
    
- Cache information.
    
- Supported instruction sets.
    
- Available RAM.
    

### GPU information

- GPU model.
    
- Streaming multiprocessor count.
    
- Compute capability.
    
- GPU memory capacity.
    
- Memory bandwidth.
    
- GPU clock frequency.
    
- Supported compute APIs.
    

### Hardware detection architecture

```text
       Hardware Detection Request
                   |
                   v
             Detection Service
                   |
          +--------+--------+
          |                 |
          v                 v
      CPU Detector      GPU Detector
          |                 |
          v                 v
      CPU Profile       GPU Profile
          |                 |
          +--------+--------+
                   |
                   v
             Hardware Profile
                   |
                   v
             Backend Storage
```

### Important implementation distinction

Hardware detection must identify the machine being measured.

A cloud-hosted backend usually detects the cloud server's hardware, not the user's personal computer.

For local hardware analysis, CoreWise AI may require a trusted local agent or benchmark client that communicates with the backend.

The hardware profile should include its source:

```json
{
  "hardware_id": "hardware_001",
  "source": "local_agent",
  "cpu_detected": true,
  "gpu_detected": true
}
```

Possible sources:

- `local_agent`
    
- `cloud_server`
    
- `user_provided`
    

Related notes:

- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Memory-Hierarchy](../02-COA-Concepts/Memory-Hierarchy.md.md)
    

---

## 8. Machine Learning Layer

The machine learning layer is responsible for predicting CPU and GPU execution times.

Python will be used for model development, training, preprocessing, evaluation, and inference.

### Proposed model architecture

CoreWise AI may use separate prediction models for CPU and GPU workloads.

```text
             WORKLOAD FEATURES
                     |
                     |
             HARDWARE FEATURES
                     |
                     v
              FEATURE PROCESSING
                     |
             +-------+-------+
             |               |
             v               v
       CPU PREDICTION   GPU PREDICTION
             |               |
             v               v
         CPU MODEL        GPU MODEL
             |               |
             v               v
        CPU TIME          GPU TIME
             |               |
             +-------+-------+
                     |
                     v
             PERFORMANCE ENGINE
```

### Candidate ML algorithms

|Algorithm|Potential use|
|---|---|
|Linear Regression|Baseline prediction|
|Random Forest|Nonlinear performance prediction|
|XGBoost|Gradient-boosted prediction|
|Neural Network|Learning complex workload/hardware relationships|

The final model should be selected through experimentation using a properly constructed benchmark dataset.

### Prediction functions

CPU prediction:

TCPU=fCPU(X,HCPU)T_{CPU}=f_{CPU}(X,H_{CPU})

GPU prediction:

TGPU=fGPU(X,HGPU)T_{GPU}=f_{GPU}(X,H_{GPU})

Where:

- XX represents workload features.
    
- HCPUH_{CPU} represents CPU characteristics.
    
- HGPUH_{GPU} represents GPU characteristics.
    
- fCPUf_{CPU} and fGPUf_{GPU} represent trained prediction models.
    

### Model input

```json
{
  "workload_features": {
    "input_size": 1000000,
    "operation_count": 2000000000,
    "parallelism_level": 0.85
  },
  "hardware_features": {
    "processor_cores": 8,
    "clock_frequency": 3.5
  }
}
```

### Model output

```json
{
  "predicted_time_ms": 125.4,
  "model_version": "1.0"
}
```

The input fields will differ between CPU and GPU models. The example is illustrative.

Related notes:

- [[ML-Prediction-Model]]
    
- [Model-Training](../04-Machine-Learning/Model-Training.md.md)
    
- [Model-Evaluation](../04-Machine-Learning/Model-Evaluation.md.md)
    
- [Dataset](../04-Machine-Learning/Dataset.md.md)
    

---

## 9. Performance Comparison and Recommendation Engine

The performance engine compares the predictions generated by the CPU and GPU models.

It calculates speedup and selects the preferred processing device according to the selected objective.

### Speedup calculation

SGPU=TCPUTGPUS_{GPU}=\frac{T_{CPU}}{T_{GPU}}

Where:

- TCPUT_{CPU} = predicted CPU execution time.
    
- TGPUT_{GPU} = predicted GPU execution time.
    

### Example

Assume:

TCPU=125.4 msT_{CPU}=125.4\ ms TGPU=42.8 msT_{GPU}=42.8\ ms

Then:

SGPU=125.442.8S_{GPU}=\frac{125.4}{42.8} SGPU≈2.93S_{GPU}\approx2.93

The predicted GPU execution is approximately 2.93 times faster under the assumed conditions.

### Recommendation logic

```text
       CPU Prediction
              |
              |
       GPU Prediction
              |
              v
       Compare Execution Times
              |
              v
        Calculate Speedup
              |
              v
        Check Constraints
              |
              v
       Select Recommended Device
              |
              v
        Generate Explanation
```

### Recommendation factors

- Predicted execution time.
    
- Memory capacity.
    
- Data-transfer overhead.
    
- Hardware availability.
    
- Workload parallelism.
    
- Prediction uncertainty.
    
- Energy consumption, if available.
    

The system should not assume that a GPU is always faster than a CPU.

For smaller workloads, GPU transfer and launch overhead may outweigh its computational advantage.

Related notes:

- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [Amdahls-Law](../02-COA-Concepts/Amdahls-Law.md.md)
    

---

## 10. Benchmarking Layer

The benchmarking layer measures actual execution performance.

It provides a mechanism for validating ML predictions against real workload execution.

### Main responsibilities

- Prepare benchmark workloads.
    
- Select execution hardware.
    
- Execute CPU workloads.
    
- Execute GPU workloads.
    
- Measure execution times.
    
- Collect hardware metrics.
    
- Store benchmark results.
    

### Benchmarking workflow

```text
       Benchmark Request
               |
               v
       Validate Configuration
               |
               v
        Prepare Workload
               |
               v
        Select Device
               |
               v
        Execute Workload
               |
               v
        Measure Execution
               |
               v
        Collect Metrics
               |
               v
        Store Benchmark
```

### Execution-time measurement

For CPU:

TCPU=tend−tstartT_{CPU}=t_{end}-t_{start}

For GPU, the end-to-end execution time may include:

TGPU=TH2D+TLaunch+TKernel+TD2H+TSyncT_{GPU}=T_{H2D}+T_{Launch}+T_{Kernel}+T_{D2H}+T_{Sync}

This is a simplified representation assuming non-overlapping operations. If data transfer and computation overlap, the measurement must account for that overlap.

### Prediction versus benchmark

|Prediction|Benchmark|
|---|---|
|Estimated execution time|Actual measured execution time|
|Uses trained ML model|Uses real execution|
|Can occur before execution|Requires execution|
|Contains model uncertainty|Contains measurement variation|
|Used for performance estimation|Used for model validation|

A prediction should never be presented as an actual benchmark measurement.

Related notes:

- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Model-Evaluation](../04-Machine-Learning/Model-Evaluation.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    

---

## 11. Agentic AI Layer

The agentic AI layer coordinates system operations and generates natural-language explanations.

LangGraph is the proposed framework for managing agent workflows.

The agent can invoke approved tools to communicate with backend services.

### Agent responsibilities

- Understand user requests.
    
- Identify the required analysis.
    
- Coordinate workload analysis.
    
- Request hardware information.
    
- Invoke CPU and GPU prediction tools.
    
- Request performance comparisons.
    
- Retrieve technical knowledge.
    
- Obtain explainability results.
    
- Generate user-friendly responses.
    

### Proposed agent workflow

```text
             USER QUERY
                  |
                  v
             LANGGRAPH
                  |
                  v
          REQUEST UNDERSTANDING
                  |
                  v
           WORKLOAD ANALYSIS
                  |
                  v
          HARDWARE INFORMATION
                  |
                  v
          CPU/GPU PREDICTIONS
                  |
                  v
         PERFORMANCE COMPARISON
                  |
                  v
           RECOMMENDATION
                  |
                  v
           EXPLAINABILITY
                  |
                  v
          NATURAL-LANGUAGE
               RESPONSE
                  |
                  v
                 USER
```

### Example user interaction

**User:**

"Which processor should I use for this matrix multiplication workload?"

**Agent operations:**

1. Understand the user's question.
    
2. Request workload analysis.
    
3. Retrieve hardware information.
    
4. Obtain CPU prediction.
    
5. Obtain GPU prediction.
    
6. Compare execution times.
    
7. Retrieve model explanation.
    
8. Generate a recommendation.
    

**Illustrative final response:**

"The GPU is predicted to execute this workload faster. The estimated CPU execution time is 125.4 ms, while the estimated GPU execution time is 42.8 ms, giving a predicted speedup of approximately 2.93x."

The agent must use actual tool results when generating this explanation.

Related notes:

- [[Agentic-AI-Architecture]]
    
- [[Agent-Workflow]]
    
- [[Tools-and-Function-Calling]]
    
- [[Memory-and-Context-Management]]
    

---

## 12. Explainability Layer

The explainability layer helps users understand why the ML model generated a particular prediction.

SHAP is a proposed explainability method.

### Main objectives

- Identify important input features.
    
- Explain model predictions.
    
- Display feature contributions.
    
- Improve transparency.
    
- Help users understand performance behavior.
    

### Example

Suppose a GPU prediction model identifies memory transfer volume as an important feature.

The explainability service may return:

```json
{
  "method": "SHAP",
  "features": [
    {
      "feature": "memory_transfer_volume",
      "contribution": 0.35
    },
    {
      "feature": "parallelism_level",
      "contribution": -0.28
    },
    {
      "feature": "input_size",
      "contribution": 0.19
    }
  ]
}
```

The values are illustrative.

SHAP contributions explain how features influenced the model output relative to its baseline. They do not establish causality.

Related note: [[Model-Explainability]]

---

## 13. Data and Knowledge Layer

PostgreSQL will serve as the primary database.

The pgvector extension can support vector storage and similarity search for technical-document retrieval.

### Structured data

The database may store:

- Users.
    
- Workloads.
    
- Hardware profiles.
    
- CPU predictions.
    
- GPU predictions.
    
- Benchmark records.
    
- Recommendations.
    
- Reports.
    
- Model metadata.
    

### Vector data

The vector retrieval system may store embeddings generated from:

- CPU documentation.
    
- GPU documentation.
    
- Benchmarking references.
    
- Processor specifications.
    
- Parallel computing documentation.
    
- Performance optimization guides.
    

### Database architecture

```text
               POSTGRESQL
                    |
          +---------+---------+
          |                   |
          v                   v
    RELATIONAL DATA       VECTOR DATA
          |                   |
          v                   v
      User Records        Embeddings
      Workloads           Documents
      Predictions         Knowledge Chunks
      Benchmarks
      Reports
          |                   |
          +---------+---------+
                    |
                    v
             BACKEND SERVICES
```

### RAG workflow

```text
Technical Documents
        |
        v
Document Processing
        |
        v
Text Chunking
        |
        v
Embedding Generation
        |
        v
PostgreSQL + pgvector
        |
        v
Similarity Retrieval
        |
        v
Retrieved Context
        |
        v
Agent Response
```

The RAG system is intended to support technical explanations. It should not replace the ML models responsible for numerical performance predictions.

Related notes:

- [[Memory-and-Context-Management]]
    
- [[Agent-Workflow]]
    
- [Dataset](../04-Machine-Learning/Dataset.md.md)
    

---

## 14. Complete End-to-End System Workflow

Consider a user submitting a matrix multiplication workload.

### Step-by-step execution

**Step 1: User input**

The user enters workload information through the Next.js interface.

**Step 2: API request**

The frontend sends the workload data to the Express.js backend.

**Step 3: Input validation**

The backend validates the workload parameters.

**Step 4: Workload analysis**

The workload analysis service extracts computational features.

**Step 5: Hardware detection**

The system retrieves the relevant CPU and GPU hardware profiles.

**Step 6: Feature processing**

The extracted workload and hardware features are transformed into model-compatible inputs.

**Step 7: CPU prediction**

The CPU ML model predicts the expected CPU execution time.

**Step 8: GPU prediction**

The GPU ML model predicts the expected GPU execution time.

**Step 9: Performance comparison**

The system compares both predictions and calculates speedup.

**Step 10: Recommendation**

The recommendation engine identifies the preferred device according to the selected objective.

**Step 11: Explainability**

The explainability service identifies important prediction features.

**Step 12: Agent response**

The LangGraph workflow combines validated tool results and generates a natural-language explanation.

**Step 13: Data persistence**

The backend stores the workload, predictions, recommendation, and relevant metadata.

**Step 14: Frontend visualization**

The Next.js frontend displays the comparison charts, prediction values, and recommendation.

### Complete workflow diagram

```text
+--------------------------+
|       USER INPUT         |
+------------+-------------+
             |
             v
+--------------------------+
|      NEXT.JS FRONTEND    |
+------------+-------------+
             |
             v
+--------------------------+
|       EXPRESS API        |
+------------+-------------+
             |
             v
+--------------------------+
|     INPUT VALIDATION     |
+------------+-------------+
             |
             v
+--------------------------+
|    WORKLOAD ANALYSIS     |
+------------+-------------+
             |
             v
+--------------------------+
|    HARDWARE DETECTION    |
+------------+-------------+
             |
             v
+--------------------------+
|     FEATURE PROCESSING  |
+------------+-------------+
             |
       +-----+-----+
       |           |
       v           v
+------------+ +------------+
| CPU MODEL  | | GPU MODEL  |
+-----+------+ +------+-----+
      |               |
      v               v
+------------+ +------------+
| CPU TIME   | | GPU TIME   |
+-----+------+ +------+-----+
      |               |
      +-------+-------+
              |
              v
+--------------------------+
| PERFORMANCE COMPARISON   |
+------------+-------------+
             |
             v
+--------------------------+
| RECOMMENDATION ENGINE    |
+------------+-------------+
             |
             v
+--------------------------+
| EXPLAINABILITY + AGENT   |
+------------+-------------+
             |
             v
+--------------------------+
|      POSTGRESQL          |
|       + pgvector         |
+------------+-------------+
             |
             v
+--------------------------+
|     JSON API RESPONSE    |
+------------+-------------+
             |
             v
+--------------------------+
|     NEXT.JS DASHBOARD    |
+------------+-------------+
             |
             v
+--------------------------+
|     FINAL RESULT         |
+--------------------------+
```

The diagram represents the proposed logical workflow. Some operations, such as CPU and GPU predictions, can execute in parallel.

---

## 15. System Data Flow

The architecture processes different types of data.

|Data Type|Source|Destination|
|---|---|---|
|User input|Frontend|Backend API|
|Workload information|User|Workload analyzer|
|Workload features|Analyzer|ML models|
|CPU specifications|Hardware detector|CPU model|
|GPU specifications|Hardware detector|GPU model|
|CPU prediction|CPU model|Performance engine|
|GPU prediction|GPU model|Performance engine|
|Benchmark measurements|Benchmark engine|Database|
|Recommendation|Recommendation engine|Frontend|
|Explainability results|SHAP service|Agent/frontend|
|Technical knowledge|RAG retrieval|Agent|
|Historical records|Database|Dashboard|

### Data processing principle

The same workload must be evaluated under compatible conditions when comparing CPU and GPU performance.

The feature-processing pipeline must remain consistent with the feature definitions used during model training.

---

## 16. Deployment Architecture

CoreWise AI may use independently deployed frontend, backend, ML, and database services.

### Proposed deployment diagram

```text
                   INTERNET
                      |
                      v
              +---------------+
              |     USERS     |
              +-------+-------+
                      |
                      v
              +---------------+
              |    VERCEL     |
              |   NEXT.JS UI  |
              +-------+-------+
                      |
                      v
              +---------------+
              | BACKEND HOST  |
              | EXPRESS API   |
              +-------+-------+
                      |
          +-----------+-----------+
          |                       |
          v                       v
  +---------------+       +---------------+
  | PYTHON ML     |       | POSTGRESQL    |
  | SERVICE       |       | + PGVECTOR    |
  +---------------+       +---------------+
          |
          v
  +---------------+
  | MODEL ARTIFACTS|
  +---------------+
```

### Deployment responsibilities

|Component|Proposed hosting|
|---|---|
|Next.js frontend|Vercel|
|Express.js backend|Railway or suitable cloud host|
|Python ML service|Suitable Python-capable host|
|PostgreSQL|Managed PostgreSQL provider|
|Vector search|PostgreSQL with pgvector|
|Model artifacts|Secure artifact storage or service filesystem|
|LLM service|Selected hosted or self-hosted provider|

### Deployment considerations

- Configure production API URLs.
    
- Protect database credentials.
    
- Enable HTTPS.
    
- Configure CORS.
    
- Restrict internal ML service access.
    
- Verify database connectivity.
    
- Configure model artifact storage.
    
- Monitor memory and CPU usage.
    
- Allocate GPU resources only where actual GPU execution is required.
    

The hosting provider must support the required hardware, drivers, and runtime dependencies if GPU benchmarking is performed in the cloud.

---

## 17. Security Architecture

Security must be applied across all layers.

### Frontend security

- Secure authentication flows.
    
- Avoid exposing private credentials.
    
- Validate user inputs.
    
- Handle sessions securely.
    

### Backend security

- Authentication and authorization middleware.
    
- Request validation.
    
- Rate limiting.
    
- Secure database access.
    
- CORS restrictions.
    
- Centralized error handling.
    

### ML service security

- Restrict internal service access.
    
- Validate model inputs.
    
- Limit inference resources.
    
- Control access to model artifacts.
    

### Benchmark security

- Execute user workloads in isolated environments.
    
- Enforce CPU, GPU, memory, and execution-time limits.
    
- Restrict filesystem access.
    
- Prevent arbitrary shell execution through AI tools.
    

### Database security

- Use parameterized queries.
    
- Apply access permissions.
    
- Back up important data.
    
- Avoid storing unnecessary sensitive information.
    

---

## 18. Scalability and Performance

The architecture should support future expansion without requiring a complete redesign.

### Proposed scalability strategies

**1. Modular services**

Separate workload analysis, prediction, benchmarking, and reporting into independent modules.

**2. Independent ML deployment**

Deploy CPU and GPU prediction services separately if workload volume increases.

**3. Asynchronous execution**

Use background jobs for long-running benchmark and document-processing operations.

**4. Database optimization**

Use indexes, connection pooling, and pagination.

**5. Caching**

Cache appropriate metadata and repeatable results using workload, hardware, and model-version identifiers.

**6. Monitoring**

Track API latency, model inference time, benchmark duration, and service failures.

**7. Model versioning**

Track model versions so historical predictions remain interpretable.

---

## 19. Limitations and Design Considerations

The proposed architecture has several important limitations that must be considered during implementation.

### Hardware access

A remote backend cannot automatically measure the user's local hardware. Local hardware detection requires a suitable local component or user-provided information.

### Prediction accuracy

ML predictions depend on dataset quality, hardware coverage, feature engineering, and model evaluation.

### Benchmark variation

Actual benchmark results may vary because of temperature, background processes, power limits, and memory conditions.

### GPU overhead

GPU execution may involve memory transfers and kernel launch overhead. Small workloads may perform better on CPUs.

### Model generalization

A model trained on a limited set of processors may not accurately predict performance on unseen hardware.

### LLM limitations

An LLM may produce incorrect explanations. Numerical recommendations must therefore be grounded in backend calculations and validated model outputs.

### Prediction uncertainty

The system should eventually communicate prediction uncertainty rather than presenting every estimate as exact.

---

## 20. System Architecture Design Principles

|Principle|Application|
|---|---|
|Modularity|Separate functional components|
|Scalability|Allow independent service expansion|
|Maintainability|Organized frontend and backend modules|
|Interoperability|REST APIs and structured JSON|
|Reliability|Validation and error handling|
|Security|Authentication and execution isolation|
|Explainability|SHAP-based model interpretation|
|Performance|Efficient inference and data processing|
|Extensibility|Support additional hardware and models|
|Transparency|Distinguish predictions from measurements|

---

## 21. Final Technology Summary

|Component|Technology|
|---|---|
|Frontend|Next.js|
|Language|TypeScript|
|Package Manager|pnpm|
|Styling|Tailwind CSS|
|UI Components|ShadCN UI|
|Icons|Lucide React|
|Charts|Recharts|
|Backend|Node.js + Express.js|
|ML Runtime|Python|
|ML Algorithms|Scikit-learn / XGBoost|
|Agent Framework|LangGraph|
|Explainability|SHAP|
|Database|PostgreSQL|
|Vector Extension|pgvector|
|ORM|Prisma|
|API Architecture|REST|
|Validation|Zod / Pydantic|
|Frontend Hosting|Vercel|
|Backend Hosting|Railway or suitable cloud provider|

---

## 22. Conclusion

CoreWise AI is designed as a modular AI-powered performance analysis platform that combines workload analysis, hardware detection, machine learning, benchmarking, and agentic AI.

The Next.js frontend provides an intuitive interface, while the Express.js backend manages application requests and coordinates specialized services.

Python-based ML models estimate CPU and GPU execution times. The performance engine compares these predictions and generates recommendations. LangGraph coordinates selected workflows and helps produce natural-language explanations using structured tool results.

PostgreSQL manages structured application data, while pgvector can support retrieval of relevant technical information.

The overall architecture is designed to be scalable, maintainable, and extensible, allowing future integration of additional processor architectures, prediction models, benchmarking tools, and intelligent optimization capabilities.

**CoreWise AI's central objective is to make CPU-versus-GPU performance analysis intelligent, measurable, explainable, and accessible through a unified platform.**

---

## 23. Related Obsidian Notes

### System Architecture

- [Frontend](Frontend.md.md)
    
- [Backend](Backend.md.md)
    
- [API-Design](API-Design.md.md)
    
- [Overall-Architecture](Overall-Architecture.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

### Computer Architecture

- [CPU-Architecture](../02-COA-Concepts/CPU-Architecture.md.md)
    
- [GPU-Architecture](../02-COA-Concepts/GPU-Architecture.md.md)
    
- [Parallel-Processing](../02-COA-Concepts/Parallel-Processing.md.md)
    
- [Memory-Hierarchy](../02-COA-Concepts/Memory-Hierarchy.md.md)
    
- [Amdahls-Law](../02-COA-Concepts/Amdahls-Law.md.md)
    

### Mathematics

- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Throughput](../03-Mathematics/Throughput.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    

### Machine Learning

- [[ML-Prediction-Model]]
    
- [Dataset](../04-Machine-Learning/Dataset.md.md)
    
- [Feature-Engineering](../04-Machine-Learning/Feature-Engineering.md.md)
    
- [Model-Training](../04-Machine-Learning/Model-Training.md.md)
    
- [Model-Evaluation](../04-Machine-Learning/Model-Evaluation.md.md)
    
- [[Model-Explainability]]
    

### Agentic AI

- [[Agentic-AI-Architecture]]
    
- [[Agent-Workflow]]
    
- [[Tools-and-Function-Calling]]
    
- [[Memory-and-Context-Management]]