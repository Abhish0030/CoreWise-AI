# Frontend Architecture — CoreWise AI

## 1. Introduction

The frontend of **CoreWise AI** is the user-facing layer responsible for providing an interactive interface through which users can analyze computational workloads, compare CPU and GPU performance, visualize predictions, and receive intelligent hardware recommendations.

The frontend will be developed using **Next.js, TypeScript, Tailwind CSS, and ShadCN UI**.

The primary objective is to create a modern, responsive, professional, and user-friendly interface that simplifies complex computer architecture and machine learning concepts.

Users should be able to interact with the system without needing advanced knowledge of CPU architecture, GPU architecture, parallel computing, or machine learning.

### Main frontend objectives

- Provide an intuitive user interface.
    
- Allow users to submit computational workloads.
    
- Display detected CPU and GPU specifications.
    
- Visualize predicted execution times.
    
- Compare CPU and GPU performance.
    
- Display AI-generated recommendations.
    
- Present performance metrics through interactive charts.
    
- Provide explanations for ML predictions.
    
- Maintain responsive layouts across desktop, tablet, and mobile devices.
    

---

## 2. Frontend Technology Stack

The following technology stack is proposed for CoreWise AI.

|Layer|Technology|Purpose|
|---|---|---|
|Framework|Next.js|Frontend application development|
|Language|TypeScript|Type-safe development|
|Package Manager|pnpm|Dependency and package management|
|Styling|Tailwind CSS|Responsive UI styling|
|UI Components|ShadCN UI|Reusable interface components|
|Icons|Lucide React|Interface icons|
|Charts|Recharts|Performance visualization|
|State Management|React Hooks / Context API|Application state management|
|HTTP Client|Axios|Backend API communication|
|Form Handling|React Hook Form|Form management|
|Validation|Zod|Input validation|
|Animations|Framer Motion|UI animations|
|Build Environment|Next.js|Application compilation and optimization|
|Database|PostgreSQL + pgvector|Backend-managed data persistence and vector search|
|Deployment|Vercel|Frontend hosting|

**Architecture decision:** PostgreSQL and pgvector belong to the backend/data layer. The frontend should access them through authenticated backend APIs rather than connecting directly to the database.

---

## 3. Why Next.js?

Next.js is selected as the primary frontend framework because it provides a structured development environment built on React.

It supports routing, server-side rendering, static generation, optimized assets, and flexible rendering strategies.

### Key advantages

**1. File-based routing**

Pages and layouts can be organized using the Next.js App Router.

**2. Server Components**

Server Components can render suitable parts of the application on the server, reducing unnecessary client-side JavaScript.

**3. Client Components**

Interactive components such as charts, forms, filters, and dashboards can use Client Components.

**4. Performance optimization**

Next.js provides built-in support for image optimization, code splitting, and optimized navigation.

**5. Scalable architecture**

The application can be organized into reusable components, layouts, features, and service modules.

### Next.js rendering strategy

CoreWise AI can use a combination of:

|Rendering approach|Application use|
|---|---|
|Server Components|Static dashboard structure and data-backed page sections|
|Client Components|Interactive charts, forms, filters, and comparison controls|
|Dynamic rendering|Personalized or frequently changing user information|
|Static rendering|Public informational pages and documentation|

The rendering strategy should be selected according to the data requirements of each page.

---

## 4. Frontend Design Reference

The CollegeHunt website screenshot is used as a visual inspiration reference.

The design demonstrates several useful UI principles:

- Clean navigation bar.
    
- Search-oriented interface.
    
- Clearly separated content sections.
    
- Card-based layouts.
    
- Consistent spacing.
    
- Simple typography.
    
- Organized categories.
    
- Responsive content presentation.
    

CoreWise AI will adapt these principles to a technical performance-analysis platform.

### Design translation

|CollegeHunt reference|CoreWise AI adaptation|
|---|---|
|Navigation bar|Main application navigation|
|College search|Workload and hardware search|
|Engineering category|CPU analysis|
|Management category|GPU analysis|
|Commerce category|Performance analytics|
|Arts category|Workload analysis|
|Science category|Benchmarking|
|Law category|Hardware comparison|
|College information cards|Hardware specification cards|
|Explore Programs|Explore CoreWise AI tools|
|Compare Colleges|Compare CPU and GPU|

The objective is to maintain a similar level of visual clarity while creating an interface specifically designed for computational performance analysis.

---

## 5. UI/UX Design Philosophy

CoreWise AI should follow a clean, modern, dashboard-oriented design.

### Design principles

**1. Simplicity**

Complex technical information should be presented in an understandable format.

**2. Consistency**

Buttons, cards, typography, spacing, colors, and layouts should follow a common design system.

**3. Information hierarchy**

Important information such as recommended hardware, predicted execution time, and speedup should receive visual priority.

**4. Responsiveness**

The interface should adapt to different screen sizes.

**5. Accessibility**

The application should use readable typography, sufficient contrast, keyboard-accessible controls, and appropriate labels.

**6. Data visualization**

Performance results should be represented using charts, comparison cards, and structured tables.

### Suggested visual identity

|Element|Proposed style|
|---|---|
|Primary color|Deep navy / blue|
|Secondary color|Electric blue|
|Background|White or light gray|
|Cards|White with subtle borders|
|Text|Dark navy / charcoal|
|Success|Green|
|Warning|Amber|
|Error|Red|
|Typography|Inter or a similar modern sans-serif|
|Border radius|Rounded cards and controls|
|Shadows|Subtle shadows|

The final design system can be refined during frontend implementation.

---

## 6. Application Navigation Structure

The main navigation should provide access to the most important features.

### Proposed navigation

```text
CoreWise AI
│
├── Home
│
├── Dashboard
│
├── Workload Analysis
│
├── CPU Analysis
│
├── GPU Analysis
│
├── Compare Performance
│
├── Benchmarking
│
├── Reports
│
├── Documentation
│
└── Profile
```

### Navigation responsibilities

|Section|Purpose|
|---|---|
|Home|Introduce CoreWise AI and its capabilities|
|Dashboard|Display performance overview|
|Workload Analysis|Analyze computational workloads|
|CPU Analysis|Display CPU specifications and predictions|
|GPU Analysis|Display GPU specifications and predictions|
|Compare Performance|Compare predicted CPU/GPU execution times|
|Benchmarking|Execute and review benchmark tests|
|Reports|View previous analysis reports|
|Documentation|Explain technical concepts|
|Profile|Manage user information and settings|

---

## 7. Proposed Frontend Pages

### 7.1 Home Page

The home page will introduce the CoreWise AI platform.

**Main components:**

- Navigation bar.
    
- Hero section.
    
- Workload analysis search/input area.
    
- Feature cards.
    
- CPU and GPU comparison overview.
    
- How CoreWise AI works.
    
- Technology overview.
    
- Footer.
    

Example layout:

```text
+------------------------------------------------------+
| CoreWise AI       Home  Dashboard  Compare  Login     |
+------------------------------------------------------+
|                                                      |
|           Intelligent CPU vs GPU Analysis            |
|                                                      |
|     Understand workload performance before running  |
|                                                      |
|       [ Enter workload or select a task ]            |
|                                                      |
|                 [ Analyze Workload ]                 |
|                                                      |
+------------------------------------------------------+
|                                                      |
|                  Explore Features                    |
|                                                      |
|  +-------------+ +-------------+ +----------------+ |
|  | CPU Analysis| | GPU Analysis| | Benchmarking   | |
|  +-------------+ +-------------+ +----------------+ |
|                                                      |
|  +-------------+ +-------------+ +----------------+ |
|  | Performance | | AI Insights | | Reports        | |
|  | Comparison  | |             | |                | |
|  +-------------+ +-------------+ +----------------+ |
|                                                      |
+------------------------------------------------------+
```

### 7.2 Dashboard Page

The dashboard provides an overview of the user's performance-analysis activities.

**Proposed components:**

- Total workloads analyzed.
    
- CPU predictions.
    
- GPU predictions.
    
- Average predicted speedup.
    
- Recent analyses.
    
- Hardware overview.
    
- Performance trend charts.
    
- Recent recommendations.
    

Example:

```text
+------------------------------------------------------+
| Dashboard                                            |
+------------------------------------------------------+
|                                                      |
|  Total Analyses   CPU Predictions   GPU Predictions  |
|  +-----------+   +-------------+   +-------------+   |
|  |    120    |   |      60     |   |      60     |   |
|  +-----------+   +-------------+   +-------------+   |
|                                                      |
|                 Performance Overview                 |
|                                                      |
|             [ CPU vs GPU Chart ]                     |
|                                                      |
|  +--------------------+  +-------------------------+ |
|  | CPU Specifications |  | GPU Specifications      | |
|  +--------------------+  +-------------------------+ |
|                                                      |
|                  Recent Analyses                     |
+------------------------------------------------------+
```

The displayed numbers are placeholders for illustrating the interface. Actual dashboard values must come from backend data.

### 7.3 Workload Analysis Page

This page allows users to submit a workload for analysis.

**Input options:**

- Workload name.
    
- Workload category.
    
- Input dimensions.
    
- Data type.
    
- Operation count, if known.
    
- Input file, where supported.
    
- Additional execution parameters.
    

**Main workflow:**

```text
User Input
    |
    v
Validate Workload
    |
    v
Submit to Backend
    |
    v
Workload Analysis
    |
    v
Receive Features
    |
    v
Display Analysis
```

Example form:

```text
+----------------------------------------------+
|              Workload Analysis               |
+----------------------------------------------+
| Workload Name                                |
| [ Matrix Multiplication                  ]   |
|                                              |
| Workload Type                                |
| [ Numerical Computing                   v ]  |
|                                              |
| Input Dimensions                             |
| [ 1000 ] x [ 1000 ]                           |
|                                              |
| Data Type                                    |
| [ Float32                               v ]  |
|                                              |
| Input File (Optional)                        |
| [ Upload File ]                              |
|                                              |
|             [ Analyze Workload ]             |
+----------------------------------------------+
```

The supported workload types and input fields will depend on the backend analysis engine.

### 7.4 CPU Analysis Page

This page displays detected CPU specifications and predicted CPU performance.

**Components:**

- CPU model.
    
- Physical cores.
    
- Logical threads.
    
- Clock frequency.
    
- Cache information.
    
- Memory information.
    
- Predicted execution time.
    
- CPU performance metrics.
    

Example:

```text
+----------------------------------------------+
|                 CPU Analysis                 |
+----------------------------------------------+
| CPU Model: Example Processor                 |
| Physical Cores: 8                            |
| Logical Threads: 16                          |
| Frequency: 3.5 GHz                           |
+----------------------------------------------+
|                                              |
| Predicted Execution Time                     |
|                                              |
|                  125.4 ms                    |
|                                              |
+----------------------------------------------+
```

Hardware values should be retrieved from the hardware-detection service.

### 7.5 GPU Analysis Page

This page displays GPU specifications and predicted GPU execution performance.

**Components:**

- GPU model.
    
- Streaming multiprocessor count.
    
- GPU clock frequency.
    
- VRAM capacity.
    
- Memory bandwidth.
    
- Compute capability.
    
- Predicted execution time.
    
- GPU utilization, when available.
    

Example:

```text
+----------------------------------------------+
|                 GPU Analysis                 |
+----------------------------------------------+
| GPU Model: Example GPU                       |
| VRAM: 8 GB                                   |
| SM Count: 40                                 |
| Memory Bandwidth: Hardware dependent         |
+----------------------------------------------+
|                                              |
| Predicted Execution Time                     |
|                                              |
|                   42.8 ms                    |
|                                              |
+----------------------------------------------+
```

All displayed values should represent detected hardware information or clearly labeled predictions.

### 7.6 Compare Performance Page

This is one of the most important pages in CoreWise AI.

It compares CPU and GPU performance for the same workload.

**Main components:**

- CPU execution-time prediction.
    
- GPU execution-time prediction.
    
- Speedup.
    
- Recommended processing device.
    
- Performance comparison chart.
    
- Explanation of the recommendation.
    

Example:

```text
+------------------------------------------------+
|              CPU vs GPU Comparison             |
+------------------------------------------------+
|                                                |
| CPU Predicted Time       GPU Predicted Time    |
|      125.4 ms                 42.8 ms          |
|                                                |
+------------------------------------------------+
|                                                |
|             Performance Chart                 |
|                                                |
| CPU  |################################|         |
| GPU  |###########                     |         |
|                                                |
+------------------------------------------------+
|                                                |
| Estimated Speedup: 2.93x                       |
|                                                |
| Recommended Device: GPU                        |
|                                                |
+------------------------------------------------+
|             AI Explanation                     |
| GPU is predicted to execute this workload      |
| faster under the evaluated conditions.         |
+------------------------------------------------+
```

The chart uses illustrative values.

The speedup calculation is:

Speedup=TCPUTGPUSpeedup=\frac{T_{CPU}}{T_{GPU}} Speedup=125.442.8≈2.93Speedup=\frac{125.4}{42.8}\approx2.93

The frontend should display the value returned by the recommendation service or calculate it from validated prediction results.

### 7.7 Benchmarking Page

The benchmarking page provides an interface for running actual performance tests.

**Proposed components:**

- Workload selection.
    
- CPU benchmark option.
    
- GPU benchmark option.
    
- Benchmark configuration.
    
- Execution progress.
    
- Actual execution-time results.
    
- Historical benchmark records.
    

Prediction and benchmarking must be visually distinguished:

|Prediction|Benchmark|
|---|---|
|Estimated execution time|Measured execution time|
|Generated by ML model|Obtained through actual execution|
|May contain prediction error|May contain measurement variation|
|Can be used before execution|Requires workload execution|

### 7.8 Reports Page

This page displays previous workload analyses and performance reports.

Possible report information:

- Workload details.
    
- Hardware information.
    
- CPU prediction.
    
- GPU prediction.
    
- Benchmark measurements.
    
- Speedup.
    
- Recommendation.
    
- Explainability results.
    
- Model version.
    
- Analysis timestamp.
    

Users may be provided with export options such as Markdown or PDF, depending on backend support.

---

## 8. Frontend Folder Structure

The proposed Next.js application will use the App Router.

```text
corewise-ai/
│
├── public/
│   ├── images/
│   ├── icons/
│   └── logo.svg
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── workload/
│   │   │   └── page.tsx
│   │   │
│   │   ├── cpu-analysis/
│   │   │   └── page.tsx
│   │   │
│   │   ├── gpu-analysis/
│   │   │   └── page.tsx
│   │   │
│   │   ├── compare/
│   │   │   └── page.tsx
│   │   │
│   │   ├── benchmarking/
│   │   │   └── page.tsx
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   └── HardwareCard.tsx
│   │   │
│   │   ├── workload/
│   │   │   └── WorkloadForm.tsx
│   │   │
│   │   ├── comparison/
│   │   │   ├── ComparisonChart.tsx
│   │   │   └── RecommendationCard.tsx
│   │   │
│   │   └── reports/
│   │       └── ReportCard.tsx
│   │
│   ├── hooks/
│   │   ├── useWorkload.ts
│   │   ├── useHardware.ts
│   │   └── usePrediction.ts
│   │
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── validations.ts
│   │   └── constants.ts
│   │
│   ├── services/
│   │   ├── api-client.ts
│   │   ├── workload-service.ts
│   │   ├── hardware-service.ts
│   │   ├── prediction-service.ts
│   │   └── benchmark-service.ts
│   │
│   ├── types/
│   │   ├── workload.ts
│   │   ├── hardware.ts
│   │   ├── prediction.ts
│   │   └── benchmark.ts
│   │
│   └── providers/
│       └── AppProviders.tsx
│
├── .env.local
├── .env.example
├── components.json
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

This structure separates pages, reusable components, API services, hooks, validation, and TypeScript definitions.

---

## 9. Package Manager — pnpm

CoreWise AI will use **pnpm** for dependency management.

### Why pnpm?

- Efficient package installation.
    
- Content-addressable package storage.
    
- Strict dependency resolution.
    
- Workspace support.
    
- Reliable lockfile-based installations.
    

### Project initialization

Create a Next.js application:

```bash
pnpm create next-app@latest corewise-ai
```

Recommended configuration:

```text
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src/ directory: Yes
App Router: Yes
Import alias: @/*
```

Navigate into the project:

```bash
cd corewise-ai
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

### Install additional dependencies

```bash
pnpm add axios recharts lucide-react framer-motion
```

Install form and validation packages:

```bash
pnpm add react-hook-form zod @hookform/resolvers
```

Initialize ShadCN UI using its CLI:

```bash
pnpm dlx shadcn@latest init
```

Add commonly used components:

```bash
pnpm dlx shadcn@latest add button card input
pnpm dlx shadcn@latest add dialog dropdown-menu
pnpm dlx shadcn@latest add select table tabs
pnpm dlx shadcn@latest add sidebar skeleton tooltip
```

The exact commands and component options may vary with the installed package versions.

---

## 10. Frontend and Backend Communication

The frontend will communicate with the backend through REST APIs.

The frontend should not directly execute ML models or access PostgreSQL.

### Communication architecture

```text
+---------------------------+
|       Next.js Frontend    |
|                           |
|  React Components         |
|  Pages and Forms          |
|  Charts and Dashboard     |
+-------------+-------------+
              |
              | HTTP / REST
              v
+---------------------------+
|      Backend API          |
|                           |
|  Express.js Services      |
|  Authentication           |
|  Workload Analysis        |
|  Prediction Services      |
+-------------+-------------+
              |
       +------+------+
       |             |
       v             v
+-------------+ +-------------+
| ML Services | | PostgreSQL  |
|             | | + pgvector  |
+-------------+ +-------------+
```

### Proposed API endpoints

|Method|Endpoint|Purpose|
|---|---|---|
|POST|`/api/workloads/analyze`|Analyze a workload|
|GET|`/api/hardware`|Retrieve hardware information|
|POST|`/api/predictions/cpu`|Predict CPU execution time|
|POST|`/api/predictions/gpu`|Predict GPU execution time|
|POST|`/api/predictions/compare`|Compare CPU and GPU|
|POST|`/api/benchmarks/run`|Start a benchmark|
|GET|`/api/benchmarks/:id`|Retrieve benchmark results|
|GET|`/api/reports`|Retrieve user reports|
|GET|`/api/reports/:id`|Retrieve a particular report|

These are proposed API contracts. The final endpoint names must match the actual backend implementation.

### Axios API client

Example:

```typescript
// src/services/api-client.ts

import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});
```

Example workload service:

```typescript
// src/services/workload-service.ts

import { apiClient } from "./api-client";

export async function analyzeWorkload(data: unknown) {
  const response = await apiClient.post(
    "/api/workloads/analyze",
    data
  );

  return response.data;
}
```

In production, `unknown` should be replaced with a properly validated TypeScript type.

---

## 11. Frontend State Management

CoreWise AI requires state management for:

- User authentication.
    
- Current workload.
    
- Detected hardware.
    
- Prediction results.
    
- Comparison results.
    
- Benchmark status.
    
- Dashboard information.
    

### Initial approach

React Hooks can manage local component state.

|Hook|Purpose|
|---|---|
|useState|Manage component state|
|useEffect|Handle side effects|
|useReducer|Manage complex local state|
|useContext|Share application-level state|

For example:

```typescript
"use client";

import { useState } from "react";

export default function WorkloadForm() {
  const [workloadName, setWorkloadName] = useState("");

  return (
    <input
      value={workloadName}
      onChange={(event) =>
        setWorkloadName(event.target.value)
      }
      placeholder="Enter workload name"
    />
  );
}
```

For larger applications, a dedicated server-state library such as TanStack Query may be introduced to manage API caching, loading states, retries, and data synchronization.

---

## 12. Data Visualization

Performance comparison is a major feature of CoreWise AI.

Recharts can be used to create interactive charts.

### Proposed charts

|Chart|Purpose|
|---|---|
|Bar Chart|Compare CPU and GPU execution times|
|Line Chart|Display benchmark trends|
|Area Chart|Visualize performance over time|
|Pie/Donut Chart|Display workload distribution|
|Radar Chart|Compare selected hardware characteristics|

### Example CPU vs GPU chart

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  {
    device: "CPU",
    executionTime: 125.4,
  },
  {
    device: "GPU",
    executionTime: 42.8,
  },
];

export default function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="device" />
        <YAxis />
        <Tooltip />
        <Bar
          dataKey="executionTime"
          name="Execution Time (ms)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

The example uses illustrative data. In the application, chart data should come from prediction or benchmark API responses.

### Visualization requirements

- Display units clearly.
    
- Distinguish predicted and measured values.
    
- Include labels and tooltips.
    
- Handle empty datasets.
    
- Display loading and error states.
    
- Avoid misleading comparisons when measurements use different timing boundaries.
    

---

## 13. Form Validation

User inputs must be validated before being submitted to the backend.

Zod can define validation schemas.

Example:

```typescript
import { z } from "zod";

export const workloadSchema = z.object({
  workloadName: z
    .string()
    .min(3, "Workload name is required"),

  rows: z
    .number()
    .int()
    .positive(),

  columns: z
    .number()
    .int()
    .positive(),

  dataType: z.enum([
    "float32",
    "float64",
    "int32",
  ]),
});
```

Validation helps prevent incomplete or invalid input from reaching the analysis service.

The backend must perform its own validation because frontend validation is not a security boundary.

---

## 14. Authentication and Protected Routes

If CoreWise AI supports user accounts, authentication should be managed through the backend authentication system.

The frontend may provide:

- Login page.
    
- Registration page.
    
- User profile.
    
- Protected dashboard.
    
- Session management.
    
- Logout functionality.
    

The frontend should use the authentication strategy selected by the backend rather than independently assuming a particular authentication provider.

### Proposed protected-route workflow

```text
User Opens Dashboard
        |
        v
Check Authentication
        |
   +----+----+
   |         |
 Authenticated  Not Authenticated
   |         |
   v         v
Dashboard   Login Page
```

Sensitive authentication tokens and secrets should not be exposed in browser-accessible environment variables.

---

## 15. Environment Configuration

The frontend may use the following environment variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Example `.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`NEXT_PUBLIC_` variables are exposed to the browser. They should only contain values that are safe for public access.

Never place the following in frontend environment variables:

- Database passwords.
    
- PostgreSQL connection strings.
    
- LLM API keys.
    
- Private authentication secrets.
    
- Backend service credentials.
    

These belong in the backend environment.

---

## 16. Loading, Error, and Empty States

The frontend must provide clear feedback during API operations.

### Loading state

When a prediction request is running:

```text
Analyzing workload...

Extracting workload features
Detecting available hardware
Predicting execution time

Please wait.
```

### Error state

If the backend is unavailable:

```text
Unable to analyze workload.

The performance analysis service is
currently unavailable.

Please try again later.
```

### Empty state

If no previous reports exist:

```text
No analysis reports found.

Submit your first workload to get started.
```

These states improve the user experience and make the application more reliable.

---

## 17. Responsive Design

CoreWise AI should support:

- Desktop screens.
    
- Laptop screens.
    
- Tablets.
    
- Mobile devices.
    

### Responsive layout strategy

|Screen|Layout|
|---|---|
|Desktop|Full navigation and multi-column dashboard|
|Laptop|Compact navigation and dashboard cards|
|Tablet|Reduced columns and adaptive navigation|
|Mobile|Single-column layout and collapsible navigation|

Tailwind CSS responsive utilities can be used.

Example:

```tsx
<div className="
  grid
  grid-cols-1
  gap-4
  md:grid-cols-2
  xl:grid-cols-3
">
  {/* Dashboard cards */}
</div>
```

---

## 18. Frontend Performance Optimization

The application should remain responsive even when displaying large amounts of performance data.

### Optimization strategies

1. Use Server Components for suitable non-interactive sections.
    
2. Use Client Components only where interactivity is required.
    
3. Lazy-load heavy chart components when appropriate.
    
4. Use pagination for historical reports.
    
5. Avoid unnecessary component re-renders.
    
6. Optimize images and static assets.
    
7. Use API caching where appropriate.
    
8. Avoid fetching the same information repeatedly.
    
9. Display skeleton loaders during data retrieval.
    
10. Keep large benchmark datasets out of unnecessary client-side state.
    

---

## 19. Testing Strategy

The frontend should be tested at multiple levels.

|Testing type|Suggested tool|Purpose|
|---|---|---|
|Unit Testing|Vitest|Test individual functions and components|
|Component Testing|React Testing Library|Test UI behavior|
|End-to-End Testing|Playwright|Test complete user workflows|
|Type Checking|TypeScript|Detect type errors|
|Linting|ESLint|Maintain code quality|

### Important test scenarios

- Workload form validation.
    
- Successful workload submission.
    
- API failure handling.
    
- CPU/GPU prediction display.
    
- Speedup calculation.
    
- Recommendation display.
    
- Benchmark status updates.
    
- Responsive navigation.
    
- Protected-route behavior.
    

---

## 20. Deployment Strategy

The Next.js frontend can be deployed using Vercel.

### Proposed deployment workflow

```text
Local Development
       |
       v
Git Repository
       |
       v
Vercel Deployment
       |
       v
Production Frontend
       |
       v
Backend API
       |
       v
ML Services and Database
```

### Deployment considerations

- Configure the production backend API URL.
    
- Configure environment variables.
    
- Enable HTTPS.
    
- Configure allowed frontend origins on the backend.
    
- Verify authentication cookie settings.
    
- Test API connectivity.
    
- Check production build logs.
    
- Verify responsive layouts.
    

The frontend and backend may be deployed independently.

---

## 21. Complete Frontend Technology Summary

|Category|Selected Technology|
|---|---|
|Framework|Next.js|
|Language|TypeScript|
|Package Manager|pnpm|
|Routing|Next.js App Router|
|Styling|Tailwind CSS|
|UI Components|ShadCN UI|
|Icons|Lucide React|
|Charts|Recharts|
|Animations|Framer Motion|
|HTTP Client|Axios|
|Forms|React Hook Form|
|Validation|Zod|
|State Management|React Hooks / Context API|
|Database Access|Through backend APIs|
|Database|PostgreSQL + pgvector (backend layer)|
|Hosting|Vercel|

---

## 22. Final Architecture Summary

The CoreWise AI frontend will be developed as a modular Next.js application.

It will provide a unified interface for workload analysis, hardware inspection, CPU/GPU prediction, performance comparison, benchmarking, and AI-generated explanations.

The frontend will communicate with the backend through REST APIs. The backend will coordinate ML services, agent workflows, hardware detection, and PostgreSQL data storage.

The design will take inspiration from the clean, card-based, search-oriented layout of CollegeHunt while maintaining a separate visual identity suitable for an AI-powered computing performance platform.

The central frontend workflow will be:

```text
USER
 |
 v
NEXT.JS INTERFACE
 |
 v
WORKLOAD SUBMISSION
 |
 v
BACKEND API
 |
 v
AI / ML PROCESSING
 |
 v
CPU AND GPU PREDICTIONS
 |
 v
PERFORMANCE COMPARISON
 |
 v
RECOMMENDATION
 |
 v
FRONTEND VISUALIZATION
 |
 v
USER
```

**Final objective:** Build a modern, responsive, scalable, and intuitive interface that makes complex CPU and GPU performance analysis accessible through a simple user experience.

---

## 23. Related Obsidian Notes

- [API-Design](API-Design.md.md)
    
- [Backend](Backend.md.md)
    
- [Overall-Architecture](Overall-Architecture.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    
- [[Agentic-AI-Architecture]]
    
- [[Tools-and-Function-Calling]]
    
- [[ML-Prediction-Model]]
    
- [Model-Evaluation](../04-Machine-Learning/Model-Evaluation.md.md)
    
- [[Model-Explainability]]
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)