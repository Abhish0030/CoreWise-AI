# Model Explainability

## 1. Introduction

Model Explainability is the process of understanding how a Machine Learning model generates its predictions and identifying which input features influence its decisions.

In CoreWise AI, the ML prediction model estimates CPU and GPU execution times. However, simply displaying predicted execution times is not sufficient. Users should also understand why the system recommends a particular processor.

For example, consider a workload where CoreWise AI predicts:

- CPU execution time: 120 ms.
    
- GPU execution time: 30 ms.
    
- Estimated speedup: 4×.
    
- Recommended processor: GPU.
    

The system should explain the factors behind this recommendation, such as:

- High workload parallelism.
    
- Large computational workload.
    
- Suitable GPU memory bandwidth.
    
- Relatively low predicted GPU execution time.
    

These explanations should be based on actual model outputs, available hardware information, and validated performance measurements.

The main objective is to make CoreWise AI more transparent, understandable, and trustworthy.

## 2. Objectives of Model Explainability

Model Explainability provides the following capabilities:

1. Identify important workload features.
    
2. Understand hardware characteristics influencing predictions.
    
3. Explain CPU and GPU execution-time estimates.
    
4. Identify factors contributing to prediction errors.
    
5. Improve transparency in processor recommendations.
    
6. Help developers understand model behavior.
    
7. Support debugging and model improvement.
    
8. Provide evidence-based explanations through the Agentic AI layer.
    

## 3. Explainability Architecture

CoreWise AI can integrate explainability into its machine learning prediction pipeline.

```text
          New Workload
               |
               v
        Feature Extraction
               |
               v
        Feature Engineering
               |
               v
        Trained ML Models
               |
        +------+------+
        |             |
        v             v
    CPU Prediction GPU Prediction
        |             |
        +------+------+
               |
               v
       Explainability Layer
               |
        +------+------+
        |             |
        v             v
   Feature         SHAP
  Importance     Analysis
        |             |
        +------+------+
               |
               v
       Recommendation Engine
               |
               v
          Agentic AI
               |
               v
       Natural Language
          Explanation
               |
               v
         Frontend UI
```

The explainability layer interprets the prediction results and provides meaningful information to the recommendation engine.

## 4. Feature Importance

Feature Importance measures how much individual input features contribute to a model's predictive behavior.

For CoreWise AI, important features may include:

- Input size.
    
- Operation count.
    
- Parallelizable fraction.
    
- Arithmetic intensity.
    
- Memory bandwidth.
    
- CPU core count.
    
- CPU clock frequency.
    
- GPU streaming multiprocessor count.
    
- GPU memory capacity.
    
- Data transfer volume.
    

For example, a trained GPU prediction model may identify arithmetic intensity and input size as important features.

This indicates that these features are useful to the model when estimating GPU execution time.

### Example Feature Importance Table

|Feature|Illustrative Importance|
|---|--:|
|Input Size|0.28|
|Arithmetic Intensity|0.24|
|Parallel Fraction|0.20|
|Memory Bandwidth|0.15|
|Data Transfer Volume|0.08|
|Hardware Specifications|0.05|

_These values are hypothetical and demonstrate how feature importance could be presented. Actual importance must be calculated from a trained model._

### Interpretation

If input size has high importance, the model relies strongly on input size when predicting execution time.

If memory bandwidth has high importance, memory-related characteristics may be important for the model's predictions.

However, feature importance does not establish causation. A feature can be important because it is correlated with another feature.

## 5. SHAP (SHapley Additive exPlanations)

SHAP is an explainability technique based on cooperative game theory.

It explains individual model predictions by assigning contribution values to input features.

The main idea is to determine how much each feature contributes to moving a prediction away from a baseline prediction.

SHAP can be applied to supported machine learning models, including tree-based models and neural networks through suitable explainers.

### 5.1 Mathematical Representation

A SHAP explanation can be represented as:

f(x)=ϕ0+∑i=1nϕif(x)=\phi_0+\sum_{i=1}^{n}\phi_i

Where:

- f(x)f(x) = model prediction for input xx.
    
- ϕ0\phi_0 = baseline prediction.
    
- ϕi\phi_i = SHAP contribution of feature ii.
    
- nn = number of features.
    

Positive SHAP values increase the prediction relative to the baseline.

Negative SHAP values decrease the prediction relative to the baseline.

### 5.2 Shapley Value Formula

The Shapley value for feature ii is:

ϕi=∑S⊆F∖{i}∣S∣!(M−∣S∣−1)!M![f(S∪{i})−f(S)]\phi_i= \sum_{S\subseteq F\setminus\{i\}} \frac{|S|!(M-|S|-1)!}{M!} [f(S\cup\{i\})-f(S)]

Where:

- FF = complete feature set.
    
- MM = total number of features.
    
- SS = subset of features excluding feature ii.
    
- f(S)f(S) = model output using feature subset SS.
    
- f(S∪{i})f(S\cup\{i\}) = model output after adding feature ii.
    

The formula calculates the average marginal contribution of a feature across possible feature combinations.

Exact calculation can be computationally expensive for large feature sets. SHAP provides specialized explainers and approximation methods to make explanations practical.

## 6. SHAP Example for CoreWise AI

Suppose the GPU execution-time model produces the following prediction:

T^GPU=30ms\hat{T}_{GPU}=30ms

Assume the baseline prediction is:

ϕ0=50ms\phi_0=50ms

The SHAP contributions are:

|Feature|SHAP Value|
|---|--:|
|Input Size|-8 ms|
|Arithmetic Intensity|-6 ms|
|Parallel Fraction|-5 ms|
|Memory Bandwidth|-3 ms|
|Data Transfer Volume|+2 ms|

Using the SHAP additive representation:

T^GPU=50−8−6−5−3+2\hat{T}_{GPU} = 50-8-6-5-3+2 T^GPU=30ms\hat{T}_{GPU}=30ms

Interpretation:

- Input size contributed to a lower predicted execution time relative to the baseline.
    
- Arithmetic intensity contributed to a lower prediction.
    
- Parallel fraction contributed to a lower prediction.
    
- Memory bandwidth contributed to a lower prediction.
    
- Data transfer volume increased the predicted execution time.
    

These contributions describe the model's behavior, not necessarily direct physical causes.

The actual interpretation depends on the trained model, feature definitions, and SHAP background dataset.

## 7. Global Explainability

Global explainability describes how a model behaves across an entire dataset.

It helps developers understand which features are generally important for predictions.

A common SHAP global importance measure is mean absolute SHAP value.

Importancei=1N∑j=1N∣ϕij∣Importance_i= \frac{1}{N}\sum_{j=1}^{N}|\phi_{ij}|

Where:

- NN = number of evaluated observations.
    
- ϕij\phi_{ij} = SHAP value of feature ii for observation jj.
    

A higher value indicates that the feature has a larger average contribution magnitude to model predictions.

### Global Explainability Example

Suppose the GPU prediction model produces:

|Feature|Mean Absolute SHAP Value|
|---|--:|
|Input Size|12.5|
|Arithmetic Intensity|9.8|
|Parallel Fraction|8.2|
|Memory Bandwidth|6.4|
|Data Transfer Volume|4.1|

The model relies more heavily on input size and arithmetic intensity across the evaluated dataset.

### Application

Global explanations help developers:

- Identify important workload characteristics.
    
- Detect irrelevant features.
    
- Improve feature engineering.
    
- Understand model behavior.
    
- Compare CPU and GPU prediction models.
    

## 8. Local Explainability

Local explainability describes why a model produced a particular prediction for one specific workload.

For example:

A user submits a matrix multiplication workload.

CoreWise AI predicts:

T^CPU=120ms\hat{T}_{CPU}=120ms T^GPU=30ms\hat{T}_{GPU}=30ms

The local explanation identifies which features contributed to each prediction.

### Example

|Feature|CPU Model Contribution|GPU Model Contribution|
|---|--:|--:|
|Input Size|+25 ms|-8 ms|
|Operation Count|+30 ms|-6 ms|
|Parallel Fraction|-5 ms|-5 ms|
|Memory Bandwidth|-10 ms|-3 ms|
|Transfer Volume|0 ms|+2 ms|

_Hypothetical values for explanation only._

The explanation helps users understand how the model arrived at its CPU and GPU estimates.

It is important to calculate SHAP values separately for the CPU and GPU models when separate prediction models are used.

## 9. SHAP Implementation Using Python

The following example demonstrates how SHAP can explain a trained Random Forest regression model.

### Step 1: Install Required Libraries

```bash
pip install shap scikit-learn pandas matplotlib joblib
```

### Step 2: Load the Trained Model

```python
import joblib
import pandas as pd

model = joblib.load("cpu_prediction_model.pkl")

X_test = pd.read_csv("test_features.csv")
```

### Step 3: Initialize SHAP Explainer

```python
import shap

explainer = shap.TreeExplainer(model)

shap_values = explainer.shap_values(X_test)
```

`TreeExplainer` is suitable for supported tree-based models such as Random Forest and XGBoost.

### Step 4: Generate Global Feature Importance

```python
import matplotlib.pyplot as plt

shap.summary_plot(
    shap_values,
    X_test,
    show=False
)

plt.tight_layout()
plt.show()
```

The summary plot displays how features influence model predictions across the evaluated samples.

### Step 5: Generate Local Explanation

```python
shap_explanation = shap.Explanation(
    values=shap_values[0],
    base_values=explainer.expected_value,
    data=X_test.iloc[0].values,
    feature_names=X_test.columns.tolist()
)

shap.plots.waterfall(shap_explanation)
```

The waterfall plot explains how individual feature contributions move the prediction away from its baseline.

The feature names, order, preprocessing, and input columns must match those used during model training.

## 10. CPU vs GPU Explainability

CoreWise AI should explain both processor predictions.

### CPU Explanation

The CPU explanation identifies the features contributing to the predicted CPU execution time.

Possible factors include:

- CPU core count.
    
- Clock frequency.
    
- Cache capacity.
    
- Workload size.
    
- Sequential execution requirements.
    
- Memory access characteristics.
    

### GPU Explanation

The GPU explanation identifies the features contributing to the predicted GPU execution time.

Possible factors include:

- GPU SM count.
    
- Memory bandwidth.
    
- Parallelizable fraction.
    
- Input size.
    
- Data transfer volume.
    
- Kernel configuration.
    

### Comparison Table

|Explanation Factor|CPU|GPU|
|---|---|---|
|Sequential processing|Important|May limit parallel benefits|
|Parallelism|Uses multiple CPU cores|Uses large-scale parallel execution|
|Memory hierarchy|CPU caches and system memory|GPU caches and VRAM|
|Data transfer|Usually within system memory hierarchy|May require host-device transfer|
|Execution overhead|CPU runtime overhead|Kernel launch and synchronization overhead|

The table describes general architectural considerations. Actual model explanations must come from the features used by the trained models.

## 11. Agentic AI Integration

The Agentic AI layer converts numerical prediction results and explainability outputs into understandable recommendations.

Its role is to communicate model evidence rather than independently invent explanations.

### Agentic AI Workflow

```text
       ML Prediction Results
                |
                v
        SHAP Contributions
                |
                v
      Recommendation Engine
                |
                v
       Evidence Collection
                |
                v
        Agentic AI Layer
                |
                v
       Natural Language
          Explanation
                |
                v
          Frontend UI
```

### Example Input to Agentic AI

```json
{
  "workload": "Matrix Multiplication",
  "cpu_prediction_ms": 120,
  "gpu_prediction_ms": 30,
  "recommended_processor": "GPU",
  "gpu_explanation": {
    "input_size": -8,
    "arithmetic_intensity": -6,
    "parallel_fraction": -5,
    "memory_bandwidth": -3,
    "data_transfer_volume": 2
  }
}
```

The SHAP values above are illustrative.

### Example Generated Explanation

"The GPU is recommended because its predicted execution time is lower than the CPU estimate. The model's explanation indicates that input size, arithmetic intensity, and parallel fraction contributed to a lower predicted GPU execution time. Data transfer volume increased the estimate, highlighting the importance of transfer overhead."

The explanation should preserve the distinction between model contributions and verified hardware behavior.

## 12. Explainability Dashboard

CoreWise AI can include a dedicated explainability section in its user interface.

Recommended components:

### 12.1 Feature Importance Chart

Displays the most influential features in the prediction model.

### 12.2 SHAP Summary Plot

Displays how feature values influence predictions across multiple workloads.

### 12.3 SHAP Waterfall Plot

Explains one individual prediction by showing positive and negative feature contributions.

### 12.4 CPU vs GPU Comparison

Displays:

- Predicted CPU execution time.
    
- Predicted GPU execution time.
    
- Estimated speedup.
    
- Important CPU features.
    
- Important GPU features.
    

### 12.5 Recommendation Explanation

Displays a natural-language summary explaining the selected processor.

## 13. Explainability and Model Debugging

Explainability is useful not only for users but also for developers.

For example, if input size unexpectedly dominates a model's predictions, developers can investigate:

- Whether the dataset contains enough workload diversity.
    
- Whether input size is correlated with another feature.
    
- Whether hardware metadata is missing.
    
- Whether the model has overfitted to particular workloads.
    
- Whether the feature calculation is correct.
    

If SHAP explanations change significantly after model retraining, this may indicate a change in model behavior.

Such changes should be investigated before deploying a new model.

## 14. Limitations of Explainability

Explainability methods have limitations.

### 14.1 Correlated Features

Features such as input size and operation count may be strongly correlated.

This can affect how feature contributions are distributed.

### 14.2 Model Dependence

Different models may produce different explanations for the same workload.

### 14.3 Computational Cost

Calculating explanations for large datasets can require significant processing time.

### 14.4 Correlation Is Not Causation

A high SHAP value indicates influence on a model prediction, not proof that the feature physically caused the execution-time change.

### 14.5 Background Dataset Dependence

SHAP explanations depend partly on the selected background dataset and feature-dependence assumptions.

The background dataset should represent the relevant workload population.

### 14.6 Explanation Reliability

If the prediction model is inaccurate, its explanation does not make the prediction reliable.

Therefore, model accuracy must be evaluated independently.

## 15. Future Improvements

Possible improvements include:

- SHAP-based global and local explanations.
    
- Feature interaction analysis.
    
- Explainability across multiple model types.
    
- Hardware-specific explanations.
    
- Counterfactual explanations.
    
- Uncertainty-aware recommendations.
    
- Explanation history and comparison.
    
- Natural-language explanation generation.
    
- Developer-focused model debugging tools.
    

Counterfactual explanations can help answer questions such as:

"What would need to change in the workload or hardware configuration for the CPU to become the better choice?"

Such explanations should be generated using valid model constraints and realistic hardware assumptions.

## 16. Conclusion

Model Explainability makes CoreWise AI's predictions more transparent and understandable.

Feature importance helps identify the features that influence model behavior across a dataset, while SHAP provides both global and individual prediction explanations.

By combining CPU and GPU model predictions with explainability results, CoreWise AI can communicate why one processor is expected to perform better for a particular workload.

The Agentic AI layer can then translate these results into natural-language explanations supported by actual model outputs.

Explainability does not guarantee prediction accuracy, but it helps users and developers understand, inspect, and improve the decision-making process.

---

## Related Notes

- [[ML-Prediction-Model]]
    
- [Dataset](Dataset.md.md)
    
- [Feature-Engineering](Feature-Engineering.md.md)
    
- [Model-Training](Model-Training.md.md)
    
- [Model-Evaluation](Model-Evaluation.md.md)
    
- [[Agentic-AI-Architecture]]
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

## Key Takeaway

**Model Explainability helps CoreWise AI understand and communicate which workload and hardware features influence its CPU and GPU execution-time predictions, making processor recommendations more transparent and interpretable.**