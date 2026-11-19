# API Design — CoreWise AI

## 1. Introduction

The API layer is the communication bridge between the CoreWise AI frontend and backend services.

CoreWise AI will use a **RESTful API architecture** to exchange structured data between the Next.js frontend, Express.js backend, Python ML services, and PostgreSQL database.

The API layer will receive user requests, validate input data, invoke the appropriate backend services, and return structured JSON responses.

### Main objectives

- Establish communication between frontend and backend.
    
- Provide standardized endpoints for workload analysis.
    
- Retrieve CPU and GPU hardware information.
    
- Execute ML-based performance predictions.
    
- Compare CPU and GPU execution times.
    
- Generate hardware recommendations.
    
- Manage benchmarking operations.
    
- Retrieve previous analysis reports.
    
- Support authentication and user-specific data.
    
- Provide consistent error handling and API responses.
    

---

## 2. API Technology Stack

|Component|Technology|Purpose|
|---|---|---|
|API Architecture|REST|Client-server communication|
|Backend Framework|Express.js|API implementation|
|Backend Language|TypeScript|Type-safe development|
|Frontend Framework|Next.js|API consumer|
|HTTP Client|Axios|Frontend API requests|
|Validation|Zod|Request validation|
|ML Service|Python / FastAPI|ML inference endpoints|
|Database|PostgreSQL|Data persistence|
|ORM|Prisma|Database operations|
|API Format|JSON|Data exchange|
|Authentication|Session-based or token-based|Secure API access|

The public application API will be exposed through Express.js. Python ML endpoints should normally remain internal to the backend architecture rather than being directly accessible from the browser.

---

## 3. API Architecture

The proposed architecture uses a centralized Express.js API gateway.

```text
                  USER
                    |
                    v
             NEXT.JS FRONTEND
                    |
                    v
              AXIOS CLIENT
                    |
                    v
             REST API REQUEST
                    |
                    v
          +---------------------+
          |    EXPRESS SERVER   |
          +---------------------+
                    |
          +---------+---------+
          |         |         |
          v         v         v
      Workload   Hardware  Authentication
       Routes     Routes      Routes
          |
          v
     SERVICE LAYER
          |
     +----+------------------+
     |                       |
     v                       v
  ML CLIENT              DATABASE
     |                  POSTGRESQL
     v                       |
 PYTHON ML SERVICE           |
     |                       |
     +-----------+-----------+
                 |
                 v
          STRUCTURED RESULT
                 |
                 v
           JSON RESPONSE
                 |
                 v
           NEXT.JS UI
```

### Communication flow

1. The user interacts with the Next.js application.
    
2. The frontend sends an HTTP request.
    
3. Express.js receives the request.
    
4. Middleware performs authentication, validation, and other checks.
    
5. The appropriate controller processes the request.
    
6. The service layer performs the required operation.
    
7. The result is retrieved from the ML service or database.
    
8. Express.js returns a structured JSON response.
    
9. The frontend displays the result.
    

---

## 4. API Base URL and Versioning

CoreWise AI should use API versioning to make future changes easier.

### Development API URL

```text
http://localhost:3001/api/v1
```

### Production API URL

```text
https://api.example.com/api/v1
```

The production hostname above is a placeholder.

### Why API versioning?

API versioning helps maintain compatibility when endpoints or response structures change.

For example:

```text
/api/v1/workloads
/api/v1/predictions
/api/v1/benchmarks
```

A future version could introduce:

```text
/api/v2/workloads
```

Existing frontend clients can continue using the previous version while migration takes place.

---

## 5. API Module Organization

The API should be divided into functional modules.

|Module|Responsibility|
|---|---|
|Authentication API|Login, registration, sessions|
|Workload API|Workload submission and analysis|
|Hardware API|CPU and GPU information|
|Prediction API|CPU/GPU performance predictions|
|Benchmark API|Actual benchmark execution|
|Recommendation API|Hardware recommendations|
|Explainability API|Prediction explanations|
|Report API|Analysis history and reports|
|Dashboard API|User performance statistics|

### Proposed endpoint structure

```text
/api/v1
│
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   └── GET  /me
│
├── /workloads
│   ├── POST /
│   ├── GET  /
│   ├── GET  /:id
│   └── POST /:id/analyze
│
├── /hardware
│   ├── GET /
│   ├── GET /cpu
│   └── GET /gpu
│
├── /predictions
│   ├── POST /cpu
│   ├── POST /gpu
│   ├── POST /compare
│   └── GET  /:id
│
├── /benchmarks
│   ├── POST /
│   ├── GET  /
│   ├── GET  /:id
│   └── POST /:id/cancel
│
├── /recommendations
│   ├── POST /
│   └── GET  /:id
│
├── /explainability
│   └── GET /:predictionId
│
├── /reports
│   ├── GET  /
│   ├── GET  /:id
│   └── POST /generate
│
└── /dashboard
    └── GET /summary
```

These endpoints represent the proposed API contract. Their implementation should be coordinated with the backend services.

---

# 6. Authentication APIs

Authentication APIs manage user identity and access to protected resources.

### 6.1 Register User

**Endpoint**

```http
POST /api/v1/auth/register
```

**Request body**

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Successful response**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "user_001",
      "name": "Example User",
      "email": "user@example.com"
    }
  }
}
```

### 6.2 Login User

**Endpoint**

```http
POST /api/v1/auth/login
```

**Request body**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Successful response**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_001",
      "email": "user@example.com"
    }
  }
}
```

The authentication implementation may use secure session cookies or a token-based approach. If cookies are used, appropriate `HttpOnly`, `Secure`, and `SameSite` settings must be configured.

### 6.3 Get Current User

**Endpoint**

```http
GET /api/v1/auth/me
```

Returns the authenticated user's profile.

### 6.4 Logout

**Endpoint**

```http
POST /api/v1/auth/logout
```

Invalidates the active session or authentication token according to the selected authentication strategy.

---

# 7. Workload APIs

The workload API manages computational workloads submitted by users.

### 7.1 Create Workload

**Endpoint**

```http
POST /api/v1/workloads
```

**Purpose**

Creates a workload record before analysis.

**Request body**

```json
{
  "name": "Matrix Multiplication",
  "workloadType": "matrix_multiplication",
  "dimensions": {
    "rows": 1000,
    "columns": 1000
  },
  "dataType": "float32"
}
```

**Response**

```json
{
  "success": true,
  "message": "Workload created successfully",
  "data": {
    "workloadId": "workload_001",
    "status": "created"
  }
}
```

### 7.2 Retrieve Workloads

**Endpoint**

```http
GET /api/v1/workloads
```

Returns the authenticated user's workload history.

### 7.3 Retrieve Individual Workload

**Endpoint**

```http
GET /api/v1/workloads/:id
```

Example:

```http
GET /api/v1/workloads/workload_001
```

### 7.4 Analyze Workload

**Endpoint**

```http
POST /api/v1/workloads/:id/analyze
```

**Purpose**

Starts workload analysis and extracts features required for ML prediction.

**Example response**

```json
{
  "success": true,
  "message": "Workload analysis completed",
  "data": {
    "workloadId": "workload_001",
    "features": {
      "inputSize": 1000000,
      "operationCount": 2000000000,
      "parallelismLevel": 0.85
    },
    "status": "analyzed"
  }
}
```

The example values are illustrative and depend on the workload definition and feature-extraction implementation.

---

# 8. Hardware Detection APIs

The hardware API provides information about available processing devices.

### 8.1 Retrieve All Hardware

**Endpoint**

```http
GET /api/v1/hardware
```

**Response**

```json
{
  "success": true,
  "data": {
    "cpu": {
      "model": "Example CPU",
      "physicalCores": 8,
      "logicalThreads": 16,
      "frequencyGHz": 3.5
    },
    "gpu": {
      "model": "Example GPU",
      "memoryGB": 8,
      "computeCapability": "example"
    }
  }
}
```

### 8.2 Retrieve CPU Information

**Endpoint**

```http
GET /api/v1/hardware/cpu
```

### 8.3 Retrieve GPU Information

**Endpoint**

```http
GET /api/v1/hardware/gpu
```

### Important hardware-detection consideration

A remotely hosted backend generally detects its own server hardware.

If CoreWise AI needs to analyze a user's personal CPU and GPU, it will require a trusted local hardware-detection agent, a benchmark client, or user-provided hardware information.

The API should identify the source of the hardware profile.

For example:

```json
{
  "hardwareSource": "local_agent",
  "hardwareId": "hardware_001"
}
```

Possible sources include:

- `local_agent`
    
- `cloud_server`
    
- `user_provided`
    

---

# 9. CPU Prediction API

The CPU prediction API communicates with the CPU ML prediction service.

### Endpoint

```http
POST /api/v1/predictions/cpu
```

### Request body

```json
{
  "workloadId": "workload_001",
  "hardwareId": "cpu_001",
  "features": {
    "inputSize": 1000000,
    "operationCount": 2000000000,
    "parallelismLevel": 0.85
  }
}
```

### Backend processing

```text
CPU Prediction Request
         |
         v
Validate Request
         |
         v
Retrieve Workload Features
         |
         v
Retrieve CPU Profile
         |
         v
Call Python ML Service
         |
         v
Load CPU Prediction Model
         |
         v
Generate Prediction
         |
         v
Validate Model Output
         |
         v
Store Prediction
         |
         v
Return JSON Response
```

### Response

```json
{
  "success": true,
  "data": {
    "predictionId": "prediction_cpu_001",
    "device": "CPU",
    "predictedTimeMs": 125.4,
    "modelVersion": "1.0",
    "unit": "milliseconds"
  }
}
```

The numerical value is illustrative.

---

# 10. GPU Prediction API

The GPU prediction API estimates workload execution time using the GPU prediction model.

### Endpoint

```http
POST /api/v1/predictions/gpu
```

### Request body

```json
{
  "workloadId": "workload_001",
  "hardwareId": "gpu_001",
  "features": {
    "inputSize": 1000000,
    "operationCount": 2000000000,
    "parallelismLevel": 0.85,
    "memoryTransferBytes": 12000000
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "predictionId": "prediction_gpu_001",
    "device": "GPU",
    "predictedTimeMs": 42.8,
    "modelVersion": "1.0",
    "unit": "milliseconds"
  }
}
```

The numerical value is illustrative.

The prediction service must use the same workload and timing definition as the CPU prediction service.

---

# 11. CPU and GPU Comparison API

This API combines CPU and GPU prediction results.

### Endpoint

```http
POST /api/v1/predictions/compare
```

### Request body

```json
{
  "workloadId": "workload_001",
  "cpuPredictionId": "prediction_cpu_001",
  "gpuPredictionId": "prediction_gpu_001",
  "objective": "minimum_execution_time"
}
```

### Backend operations

1. Retrieve CPU prediction.
    
2. Retrieve GPU prediction.
    
3. Validate prediction status.
    
4. Verify compatible workload and timing definitions.
    
5. Calculate speedup.
    
6. Evaluate recommendation constraints.
    
7. Generate comparison result.
    
8. Store comparison record.
    

### Speedup calculation

SGPU=TCPUTGPUS_{GPU}=\frac{T_{CPU}}{T_{GPU}}

Using illustrative values:

SGPU=125.442.8S_{GPU}=\frac{125.4}{42.8} SGPU≈2.93S_{GPU}\approx2.93

### Response

```json
{
  "success": true,
  "data": {
    "comparisonId": "comparison_001",
    "cpuTimeMs": 125.4,
    "gpuTimeMs": 42.8,
    "speedup": 2.93,
    "recommendedDevice": "GPU",
    "objective": "minimum_execution_time"
  }
}
```

The comparison API should not treat a missing prediction as zero or generate a misleading speedup.

---

# 12. Benchmarking APIs

Benchmarking APIs allow users to execute controlled tests and retrieve actual performance measurements.

### 12.1 Start Benchmark

**Endpoint**

```http
POST /api/v1/benchmarks
```

**Request body**

```json
{
  "workloadId": "workload_001",
  "device": "GPU",
  "configuration": {
    "warmupRuns": 3,
    "measurementRuns": 10
  }
}
```

**Response**

```json
{
  "success": true,
  "message": "Benchmark job created",
  "data": {
    "benchmarkId": "benchmark_001",
    "status": "queued"
  }
}
```

### 12.2 Retrieve Benchmark Status

**Endpoint**

```http
GET /api/v1/benchmarks/:id
```

**Response**

```json
{
  "success": true,
  "data": {
    "benchmarkId": "benchmark_001",
    "status": "running",
    "progress": 60
  }
}
```

### 12.3 Benchmark Result

After completion:

```json
{
  "success": true,
  "data": {
    "benchmarkId": "benchmark_001",
    "status": "completed",
    "device": "GPU",
    "executionTimeMs": 45.2,
    "measurementRuns": 10
  }
}
```

The execution time is illustrative.

### 12.4 Cancel Benchmark

**Endpoint**

```http
POST /api/v1/benchmarks/:id/cancel
```

Cancels a benchmark job when cancellation is supported by the execution system.

Benchmark APIs should enforce authorization, execution timeouts, resource limits, and concurrency restrictions.

---

# 13. Recommendation API

The recommendation API returns the preferred processing device according to the selected objective and available evidence.

### Endpoint

```http
POST /api/v1/recommendations
```

### Request

```json
{
  "comparisonId": "comparison_001",
  "objective": "minimum_execution_time"
}
```

### Possible objectives

|Objective|Description|
|---|---|
|minimum_execution_time|Select the device with lower predicted execution time|
|energy_efficiency|Prefer lower estimated energy consumption|
|memory_efficiency|Consider available memory and memory requirements|
|balanced|Consider multiple configured performance constraints|

Objectives other than execution time require the corresponding measurements or models. They should not be presented as supported until those capabilities exist.

### Response

```json
{
  "success": true,
  "data": {
    "recommendationId": "recommendation_001",
    "recommendedDevice": "GPU",
    "reason": "The predicted GPU execution time is lower.",
    "estimatedSpeedup": 2.93
  }
}
```

---

# 14. Explainability API

The explainability API provides information about which features influenced a prediction.

SHAP is a possible explainability method.

### Endpoint

```http
GET /api/v1/explainability/:predictionId
```

### Example response

```json
{
  "success": true,
  "data": {
    "predictionId": "prediction_gpu_001",
    "method": "SHAP",
    "features": [
      {
        "name": "memoryTransferBytes",
        "contribution": 0.35
      },
      {
        "name": "parallelismLevel",
        "contribution": -0.28
      },
      {
        "name": "inputSize",
        "contribution": 0.19
      }
    ]
  }
}
```

The values are illustrative.

The API should identify the model version and explainability method used. SHAP contributions explain model behavior; they should not be described as proof of causality.

---

# 15. Report APIs

The report APIs provide access to saved workload analyses and performance results.

### 15.1 Retrieve Reports

```http
GET /api/v1/reports
```

Supports pagination and filtering.

Example:

```http
GET /api/v1/reports?page=1&limit=10
```

### 15.2 Retrieve Individual Report

```http
GET /api/v1/reports/:id
```

### 15.3 Generate Report

```http
POST /api/v1/reports/generate
```

Request:

```json
{
  "workloadId": "workload_001",
  "comparisonId": "comparison_001",
  "format": "pdf"
}
```

Possible report formats:

- JSON
    
- Markdown
    
- PDF
    

The backend should only generate reports from validated, stored results.

---

# 16. Dashboard API

The dashboard API provides summarized information for the frontend dashboard.

### Endpoint

```http
GET /api/v1/dashboard/summary
```

### Example response

```json
{
  "success": true,
  "data": {
    "totalWorkloads": 120,
    "totalPredictions": 240,
    "totalBenchmarks": 50,
    "recentActivities": []
  }
}
```

The numbers are illustrative placeholders, not actual project statistics.

---

# 17. Request Validation

Every API endpoint should validate incoming data before processing it.

Zod can be used for TypeScript API validation.

### Example workload schema

```typescript
import { z } from "zod";

export const workloadSchema = z.object({
  name: z.string().min(3).max(100),

  workloadType: z.enum([
    "matrix_multiplication",
    "image_processing",
    "machine_learning",
    "general_computation"
  ]),

  dimensions: z.object({
    rows: z.number().int().positive(),
    columns: z.number().int().positive()
  }),

  dataType: z.enum([
    "float32",
    "float64",
    "int32"
  ])
});
```

### Validation workflow

```text
Incoming Request
       |
       v
Schema Validation
       |
   +---+---+
   |       |
Valid    Invalid
   |       |
   v       v
Process  Return
Request  400 Error
```

Validation should be performed on the backend even if the frontend already validates the form.

---

# 18. Standard API Response Format

All API modules should follow a consistent response structure.

### Successful response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Failed response

```json
{
  "success": false,
  "message": "Operation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "Invalid request parameters"
  }
}
```

### Benefits

- Consistent frontend integration.
    
- Predictable error handling.
    
- Easier debugging.
    
- Standardized API documentation.
    
- Simplified testing.
    

---

# 19. HTTP Status Codes

The backend should use appropriate HTTP status codes.

|Status Code|Meaning|Example|
|---|---|---|
|200|OK|Successful GET or completed operation|
|201|Created|Workload created|
|202|Accepted|Benchmark job queued|
|400|Bad Request|Invalid input|
|401|Unauthorized|Authentication required|
|403|Forbidden|User lacks permission|
|404|Not Found|Workload does not exist|
|409|Conflict|Duplicate resource or conflicting operation|
|422|Unprocessable Entity|Valid JSON but invalid business data|
|429|Too Many Requests|Rate limit exceeded|
|500|Internal Server Error|Unexpected backend error|
|502|Bad Gateway|Invalid response from an upstream service|
|503|Service Unavailable|ML service unavailable|
|504|Gateway Timeout|Upstream service timed out|

---

# 20. Authentication and API Security

Protected APIs should require valid authentication.

### Security requirements

1. Authenticate users before accessing private resources.
    
2. Verify resource ownership.
    
3. Validate all request bodies and query parameters.
    
4. Apply rate limits.
    
5. Configure CORS for approved origins.
    
6. Use HTTPS in production.
    
7. Protect authentication cookies.
    
8. Keep API credentials on the server.
    
9. Avoid exposing internal error details.
    
10. Apply execution limits to benchmark endpoints.
    

### Example protected API flow

```text
Frontend Request
       |
       v
Authentication Middleware
       |
       v
Verify Session
       |
   +---+---+
   |       |
Valid    Invalid
   |       |
   v       v
Controller 401 Response
   |
   v
Service Layer
```

---

# 21. Long-Running API Operations

Some operations may take longer than a normal HTTP request.

Examples:

- Large benchmark executions.
    
- ML model initialization.
    
- Document processing.
    
- Complex workload analysis.
    

These operations should use asynchronous job processing.

### Job-based architecture

```text
POST /benchmarks
       |
       v
Create Background Job
       |
       v
Return HTTP 202
       |
       v
Background Worker
       |
       v
Execute Benchmark
       |
       v
Store Result
       |
       v
GET /benchmarks/:id
       |
       v
Return Current Status
```

Possible job states:

|Status|Meaning|
|---|---|
|queued|Waiting for execution|
|running|Currently executing|
|completed|Successfully finished|
|failed|Execution failed|
|cancelled|Cancelled by user or system|

For real-time updates, the application may later introduce Server-Sent Events or WebSockets. Polling is sufficient for an initial implementation.

---

# 22. API Error Handling

The API should return meaningful error messages.

### Proposed error codes

|Error Code|Description|
|---|---|
|INVALID_WORKLOAD|Workload data is invalid|
|WORKLOAD_NOT_FOUND|Requested workload does not exist|
|HARDWARE_UNAVAILABLE|Hardware detection failed|
|CPU_MODEL_UNAVAILABLE|CPU prediction model unavailable|
|GPU_MODEL_UNAVAILABLE|GPU prediction model unavailable|
|ML_SERVICE_ERROR|ML service failed|
|BENCHMARK_TIMEOUT|Benchmark exceeded execution limit|
|DATABASE_ERROR|Database operation failed|
|UNAUTHORIZED|User is not authenticated|
|FORBIDDEN|User lacks required permission|

### Example error response

```json
{
  "success": false,
  "message": "GPU prediction is unavailable",
  "error": {
    "code": "GPU_MODEL_UNAVAILABLE"
  }
}
```

The frontend can use these error codes to display appropriate messages.

---

# 23. API Documentation and Testing

API documentation should be maintained alongside implementation.

### Suggested tools

|Tool|Purpose|
|---|---|
|Swagger / OpenAPI|API specification|
|Postman|Manual API testing|
|Supertest|Automated Express API tests|
|Vitest|Unit testing|
|Zod|Request validation|

### API documentation should include

- Endpoint name.
    
- HTTP method.
    
- URL.
    
- Description.
    
- Authentication requirements.
    
- Request parameters.
    
- Request body.
    
- Response structure.
    
- Error codes.
    
- Example requests and responses.
    

### Example OpenAPI structure

```yaml
openapi: 3.0.3

info:
  title: CoreWise AI API
  version: 1.0.0

paths:
  /api/v1/hardware:
    get:
      summary: Retrieve hardware information
      responses:
        "200":
          description: Hardware information retrieved
```

The complete OpenAPI specification should be generated and maintained as endpoints are implemented.

---

# 24. API Performance and Reliability

The API layer should be designed to handle concurrent requests and long-running operations safely.

### Recommended practices

- Use request timeouts.
    
- Implement pagination.
    
- Apply database connection pooling.
    
- Limit benchmark concurrency.
    
- Avoid unnecessary database queries.
    
- Cache appropriate read-only data.
    
- Use background jobs for expensive operations.
    
- Validate external ML service responses.
    
- Implement controlled retries.
    
- Monitor API latency and failure rates.
    

Retries should only be used when safe. Operations that launch workloads or benchmarks should not be repeated blindly.

---

# 25. Complete API Workflow

Consider a user requesting CPU and GPU performance comparison.

```text
USER
 |
 v
NEXT.JS FRONTEND
 |
 v
POST /api/v1/workloads
 |
 v
CREATE WORKLOAD
 |
 v
POST /api/v1/workloads/:id/analyze
 |
 v
EXTRACT WORKLOAD FEATURES
 |
 v
GET /api/v1/hardware
 |
 v
RETRIEVE HARDWARE PROFILE
 |
 v
POST /api/v1/predictions/cpu
 |
 v
CPU ML PREDICTION
 |
 v
POST /api/v1/predictions/gpu
 |
 v
GPU ML PREDICTION
 |
 v
POST /api/v1/predictions/compare
 |
 v
CALCULATE SPEEDUP
 |
 v
POST /api/v1/recommendations
 |
 v
GENERATE RECOMMENDATION
 |
 v
STORE RESULTS
 |
 v
RETURN JSON
 |
 v
DISPLAY IN NEXT.JS
```

The API sequence above is illustrative. In an optimized implementation, the frontend may invoke one orchestration endpoint that coordinates workload analysis, hardware retrieval, and both predictions internally.

This reduces frontend complexity and avoids exposing unnecessary internal service operations.

---

# 26. Recommended API Design Decisions

|Design Area|Decision|
|---|---|
|Architecture|RESTful API|
|API Version|`/api/v1`|
|Backend|Express.js + TypeScript|
|Request Format|JSON|
|Response Format|Standardized JSON|
|Validation|Zod|
|ML Integration|Internal Python API|
|Database|PostgreSQL|
|Vector Search|pgvector|
|Authentication|Secure backend-managed sessions or tokens|
|Documentation|OpenAPI / Swagger|
|Testing|Vitest / Supertest|
|Long Operations|Background jobs|
|Deployment|Cloud-hosted backend|

---

# 27. Final Summary

The CoreWise AI API architecture provides a standardized communication layer between the Next.js frontend and backend processing services.

The REST APIs will support workload submission, hardware detection, CPU/GPU prediction, benchmarking, performance comparison, recommendation generation, explainability, and report management.

Express.js will expose the application APIs, while Python services will handle ML inference. PostgreSQL will store structured application information, and pgvector will support vector-based knowledge retrieval where required.

The API architecture will prioritize:

- Consistency.
    
- Security.
    
- Modularity.
    
- Scalability.
    
- Type safety.
    
- Reliable communication.
    
- Clear error handling.
    
- Maintainable documentation.
    

**Final objective:** Establish a secure, structured, and scalable API layer that connects every major CoreWise AI component and delivers reliable performance-analysis results to the frontend.

---

## 28. Related Obsidian Notes

- [Frontend](Frontend.md.md)
    
- [Backend](Backend.md.md)
    
- [Overall-Architecture](Overall-Architecture.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    
- [[Agentic-AI-Architecture]]
    
- [[Tools-and-Function-Calling]]
    
- [[Memory-and-Context-Management]]
    
- [[ML-Prediction-Model]]
    
- [Dataset](../04-Machine-Learning/Dataset.md.md)
    
- [Feature-Engineering](../04-Machine-Learning/Feature-Engineering.md.md)
    
- [Model-Training](../04-Machine-Learning/Model-Training.md.md)
    
- [Model-Evaluation](../04-Machine-Learning/Model-Evaluation.md.md)
    
- [[Model-Explainability]]
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)