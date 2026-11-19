# Model Evaluation

## 1. Introduction

Model Evaluation is the process of measuring how accurately a trained Machine Learning model performs on previously unseen data.

In CoreWise AI, model evaluation is essential because the system must predict CPU and GPU execution times reliably before recommending a processor.

A model that performs well on training data may still produce inaccurate predictions on new workloads or hardware configurations. Therefore, evaluating the model using independent test data is necessary.

The primary objectives are:

1. Measure CPU execution-time prediction accuracy.
    
2. Measure GPU execution-time prediction accuracy.
    
3. Compare different regression algorithms.
    
4. Evaluate CPU-versus-GPU recommendation accuracy.
    
5. Identify prediction errors and model limitations.
    
6. Test generalization across unseen workloads and hardware.
    
7. Determine whether the model is reliable enough for deployment.
    

## 2. Model Evaluation Workflow

CoreWise AI follows a systematic evaluation pipeline.

```text
       Trained ML Models
               |
               v
       Unseen Test Dataset
               |
               v
       Generate Predictions
               |
        +------+------+
        |             |
        v             v
    CPU Model     GPU Model
        |             |
        v             v
    CPU Time      GPU Time
        |             |
        +------+------+
               |
               v
       Compare Actual Values
               |
               v
       Calculate Error Metrics
               |
               v
       Evaluate Recommendation
               |
               v
       Analyze Generalization
               |
               v
       Model Selection
               |
               v
       Deployment Decision
```

## 3. Regression Evaluation Metrics

Since CoreWise AI predicts numerical execution times, regression metrics are used to evaluate prediction performance.

### 3.1 Mean Absolute Error (MAE)

MAE measures the average absolute difference between actual and predicted execution times.

MAE=1N∑i=1N∣Yi−Y^i∣MAE=\frac{1}{N}\sum_{i=1}^{N}|Y_i-\hat{Y}_i|

Where:

- NN = number of test observations.
    
- YiY_i = actual execution time.
    
- Y^i\hat{Y}_i = predicted execution time.
    

**Example:**

Suppose the actual CPU execution times are:

Y=[100,200,300]Y=[100,200,300]

The model predicts:

Y^=[110,190,280]\hat{Y}=[110,190,280]

Then:

MAE=∣100−110∣+∣200−190∣+∣300−280∣3MAE=\frac{|100-110|+|200-190|+|300-280|}{3} MAE=10+10+203MAE=\frac{10+10+20}{3} MAE=13.33msMAE=13.33ms

The model has an average absolute prediction error of approximately 13.33 milliseconds.

### 3.2 Mean Squared Error (MSE)

MSE calculates the average squared difference between actual and predicted values.

MSE=1N∑i=1N(Yi−Y^i)2MSE=\frac{1}{N}\sum_{i=1}^{N}(Y_i-\hat{Y}_i)^2

Using the previous example:

MSE=(100−110)2+(200−190)2+(300−280)23MSE=\frac{(100-110)^2+(200-190)^2+(300-280)^2}{3} MSE=100+100+4003MSE=\frac{100+100+400}{3} MSE=200MSE=200

MSE gives greater weight to large prediction errors.

### 3.3 Root Mean Squared Error (RMSE)

RMSE is the square root of MSE.

RMSE=1N∑i=1N(Yi−Y^i)2RMSE=\sqrt{\frac{1}{N}\sum_{i=1}^{N}(Y_i-\hat{Y}_i)^2}

For the previous example:

RMSE=200RMSE=\sqrt{200} RMSE≈14.14msRMSE\approx14.14ms

RMSE is expressed in the same unit as execution time.

### 3.4 Coefficient of Determination (R2R^2)

The coefficient of determination measures how much variation in the actual target values is explained by the model.

R2=1−∑i=1N(Yi−Y^i)2∑i=1N(Yi−Yˉ)2R^2=1-\frac{\sum_{i=1}^{N}(Y_i-\hat{Y}_i)^2} {\sum_{i=1}^{N}(Y_i-\bar{Y})^2}

Where:

- YiY_i = actual value.
    
- Y^i\hat{Y}_i = predicted value.
    
- Yˉ\bar{Y} = mean of actual values.
    

Interpretation:

- R2=1R^2=1: perfect prediction.
    
- R2=0R^2=0: no improvement over predicting the test-set mean, under the standard definition.
    
- R2<0R^2<0: the model performs worse than that mean baseline.
    

A high R2R^2 does not automatically mean that execution-time predictions have low practical error. It should be considered alongside MAE and RMSE.

### 3.5 Mean Absolute Percentage Error (MAPE)

MAPE expresses prediction error as a percentage of actual execution time.

MAPE=100N∑i=1N∣Yi−Y^iYi∣MAPE=\frac{100}{N}\sum_{i=1}^{N} \left|\frac{Y_i-\hat{Y}_i}{Y_i}\right|

A lower MAPE generally indicates smaller relative prediction errors.

However, MAPE is undefined when actual execution time is zero and can become unstable when actual values are very small.

For such cases, MAE, RMSE, or another suitable metric should be preferred.

## 4. CPU and GPU Prediction Evaluation

CoreWise AI should evaluate CPU and GPU prediction models independently.

### CPU Prediction Evaluation

The CPU model receives workload and CPU hardware features.

T^CPU=fθ(XCPU)\hat{T}_{CPU}=f_{\theta}(X_{CPU})

Its predictions are compared against measured CPU execution times.

ErrorCPU=TCPU−T^CPUError_{CPU}=T_{CPU}-\hat{T}_{CPU}

### GPU Prediction Evaluation

The GPU model receives workload and GPU hardware features.

T^GPU=gϕ(XGPU)\hat{T}_{GPU}=g_{\phi}(X_{GPU})

Its predictions are compared against measured GPU execution times.

ErrorGPU=TGPU−T^GPUError_{GPU}=T_{GPU}-\hat{T}_{GPU}

Separate evaluation helps identify whether the model performs better on one processor type than the other.

### Example Evaluation Table

|Workload|Actual CPU (ms)|Predicted CPU (ms)|Actual GPU (ms)|Predicted GPU (ms)|
|---|--:|--:|--:|--:|
|Matrix Multiplication|100|105|25|27|
|Image Processing|80|76|30|33|
|Vector Addition|10|12|15|14|

_All values are hypothetical and are included only to demonstrate the evaluation process._

## 5. Processor Recommendation Evaluation

Predicting execution time accurately is important, but CoreWise AI must also make the correct processor recommendation.

The recommendation engine compares predicted CPU and GPU execution times.

Rpredicted={CPUT^CPU<T^GPUGPUT^GPU<T^CPUEquivalentdifference is negligibleR_{predicted}= \begin{cases} CPU & \hat{T}_{CPU}<\hat{T}_{GPU}\\ GPU & \hat{T}_{GPU}<\hat{T}_{CPU}\\ Equivalent & \text{difference is negligible} \end{cases}

The actual recommendation outcome is determined by comparing measured execution times using consistent measurement boundaries.

Ractual={CPUTCPU<TGPUGPUTGPU<TCPUEquivalentdifference is negligibleR_{actual}= \begin{cases} CPU & T_{CPU}<T_{GPU}\\ GPU & T_{GPU}<T_{CPU}\\ Equivalent & \text{difference is negligible} \end{cases}

The predicted recommendation can then be compared with the actual outcome.

### Example

Suppose:

TCPU=100msT_{CPU}=100ms TGPU=25msT_{GPU}=25ms

Actual speedup:

S=10025=4S=\frac{100}{25}=4

The GPU is four times faster in this example.

If the prediction model estimates:

T^CPU=105ms\hat{T}_{CPU}=105ms T^GPU=27ms\hat{T}_{GPU}=27ms

Then the estimated speedup is:

S^=10527≈3.89\hat{S}=\frac{105}{27}\approx3.89

The model correctly recommends the GPU.

This demonstrates why recommendation quality and execution-time prediction quality should both be evaluated.

## 6. Recommendation Accuracy

Recommendation accuracy measures how frequently the system selects the processor with the better measured performance.

For a two-class CPU-versus-GPU recommendation problem:

Accuracy=CorrectRecommendationsTotalRecommendations×100Accuracy=\frac{CorrectRecommendations} {TotalRecommendations}\times100

Example:

Suppose CoreWise AI evaluates 100 workloads and makes 90 correct recommendations.

Accuracy=90100×100Accuracy=\frac{90}{100}\times100 Accuracy=90%Accuracy=90\%

This means 90% of recommendations matched the measured faster processor under the evaluation conditions.

If the system includes an Equivalent or Uncertain category, evaluation should also report how often the system abstains and how accurate its non-abstained recommendations are.

## 7. Confusion Matrix

A confusion matrix helps identify the types of processor recommendation errors.

For a binary CPU-versus-GPU evaluation:

|Actual / Predicted|Predicted CPU|Predicted GPU|
|---|--:|--:|
|Actual CPU|True CPU|Incorrect GPU|
|Actual GPU|Incorrect CPU|True GPU|

The four outcomes are:

- True CPU: CPU is actually faster and the model recommends CPU.
    
- True GPU: GPU is actually faster and the model recommends GPU.
    
- Incorrect GPU: CPU is actually faster, but the model recommends GPU.
    
- Incorrect CPU: GPU is actually faster, but the model recommends CPU.
    

This is useful because different errors may have different performance consequences.

For example, recommending GPU when it is slightly slower may have a small impact. Recommending GPU when it is significantly slower may cause substantial performance degradation.

## 8. Speedup Prediction Evaluation

CoreWise AI can also estimate the speedup of GPU execution relative to CPU execution.

Actual speedup:

Sactual=TCPUTGPUS_{actual}=\frac{T_{CPU}}{T_{GPU}}

Predicted speedup:

Spredicted=T^CPUT^GPUS_{predicted}=\frac{\hat{T}_{CPU}}{\hat{T}_{GPU}}

The speedup estimation error can be calculated as:

ES=∣Sactual−Spredicted∣E_S=|S_{actual}-S_{predicted}|

Percentage speedup error:

ES%=∣Sactual−Spredicted∣Sactual×100E_{S\%}= \frac{|S_{actual}-S_{predicted}|} {S_{actual}}\times100

This metric helps determine whether CoreWise AI accurately estimates the performance advantage of one processor over another.

It is especially useful when users want to understand not just which processor is faster, but how much faster it is expected to be.

## 9. Model Comparison

Different algorithms should be evaluated using the same test conditions.

Example comparison:

|Algorithm|CPU MAE|GPU MAE|CPU RMSE|GPU RMSE|
|---|--:|--:|--:|--:|
|Linear Regression|To be measured|To be measured|To be measured|To be measured|
|Random Forest|To be measured|To be measured|To be measured|To be measured|
|XGBoost|To be measured|To be measured|To be measured|To be measured|
|Neural Network|To be measured|To be measured|To be measured|To be measured|

The final model should be selected based on:

1. Low prediction error.
    
2. Strong validation performance.
    
3. Good generalization.
    
4. Reasonable inference time.
    
5. Stable performance across workload categories.
    
6. Reliable CPU-versus-GPU recommendations.
    

Do not select a model based on training accuracy alone.

## 10. Generalization Testing

Generalization refers to a model's ability to make accurate predictions on data it has not encountered during training.

CoreWise AI should evaluate multiple generalization scenarios.

### 10.1 Unseen Workloads

Train the model on selected workload types and evaluate it on workload families excluded from training.

This helps determine whether the model can handle new computational tasks.

### 10.2 Unseen Hardware

Train using selected CPU and GPU configurations, then evaluate on hardware configurations excluded from training.

This tests hardware generalization.

A model trained on one GPU architecture should not automatically be assumed to predict accurately on a different architecture.

### 10.3 Different Input Sizes

Train using multiple workload sizes and evaluate whether the model can predict performance for larger or smaller input sizes.

This is important because processor performance may change as workload size increases.

### 10.4 Software Environment Changes

Evaluate how changes in compiler versions, drivers, libraries, and execution environments affect prediction accuracy.

These changes can influence measured execution times even when hardware remains unchanged.

## 11. Prediction Uncertainty

A prediction is an estimate and may contain uncertainty.

Two processors may have very similar predicted execution times, but the model may not be accurate enough to distinguish between them confidently.

For example:

T^CPU=50ms\hat{T}_{CPU}=50ms T^GPU=48ms\hat{T}_{GPU}=48ms

The predicted difference is only 2 milliseconds.

If the model's expected prediction error is larger than this difference, making a strong recommendation may be inappropriate.

### Decision Margin

A relative decision margin can be calculated as:

Δ=∣T^CPU−T^GPU∣min⁡(T^CPU,T^GPU)\Delta= \frac{|\hat{T}_{CPU}-\hat{T}_{GPU}|} {\min(\hat{T}_{CPU},\hat{T}_{GPU})}

A configurable threshold can determine whether the predicted difference is meaningful.

For example:

- Large difference: provide a stronger recommendation.
    
- Small difference: report similar predicted performance.
    
- High prediction uncertainty: recommend benchmarking before making a final decision.
    

Prediction intervals or calibrated uncertainty estimates can improve this process.

## 12. Actual Benchmark Validation

Machine learning predictions should eventually be compared with real benchmark measurements.

The validation process is:

1. Select a workload.
    
2. Collect its workload features.
    
3. Generate CPU and GPU execution-time predictions.
    
4. Execute the workload on the CPU.
    
5. Execute the equivalent workload on the GPU.
    
6. Measure execution times using consistent boundaries.
    
7. Compare actual and predicted values.
    
8. Calculate prediction and recommendation errors.
    
9. Store the results for future analysis.
    

### Prediction Error

Error=Tactual−TpredictedError=T_{actual}-T_{predicted}

### Absolute Error

AbsoluteError=∣Tactual−Tpredicted∣AbsoluteError=|T_{actual}-T_{predicted}|

### Relative Error

RelativeError=∣Tactual−Tpredicted∣Tactual×100RelativeError= \frac{|T_{actual}-T_{predicted}|} {T_{actual}}\times100

Relative error should not be used directly when actual execution time is zero or extremely small.

## 13. Model Evaluation Using Python

The following example evaluates a trained regression model using test data.

```python
import pandas as pd
import numpy as np

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

# Load actual test values
actual = pd.Series([100, 200, 300, 400])

# Example model predictions
predicted = pd.Series([105, 190, 310, 380])

# Calculate evaluation metrics
mae = mean_absolute_error(actual, predicted)

mse = mean_squared_error(actual, predicted)

rmse = np.sqrt(mse)

r2 = r2_score(actual, predicted)

print("Model Evaluation Results")
print("------------------------")
print("MAE:", mae)
print("MSE:", mse)
print("RMSE:", rmse)
print("R2 Score:", r2)
```

This example demonstrates the evaluation calculations using hypothetical data. In the actual project, the `predicted` values should come from the trained model applied to the independent test dataset.

### Recommendation Evaluation Example

```python
actual_cpu = 100
actual_gpu = 25

predicted_cpu = 105
predicted_gpu = 27

actual_recommendation = (
    "CPU" if actual_cpu < actual_gpu else "GPU"
)

predicted_recommendation = (
    "CPU" if predicted_cpu < predicted_gpu else "GPU"
)

print("Actual Recommendation:", actual_recommendation)

print("Predicted Recommendation:", predicted_recommendation)

print(
    "Correct Recommendation:",
    actual_recommendation == predicted_recommendation
)
```

This example assumes there is a clear difference between processor execution times. A real implementation should include an Equivalent or Uncertain outcome when the performance difference is within a defined tolerance.

## 14. Evaluation Dashboard

CoreWise AI can present evaluation results through a dashboard.

Recommended visualizations include:

### Actual vs Predicted Plot

Displays actual execution times against predicted execution times.

A model with accurate predictions should have points close to the diagonal reference line.

### Residual Plot

Residuals are calculated as:

Residual=Y−Y^Residual=Y-\hat{Y}

The residual plot helps identify systematic prediction errors.

### Error Distribution

Displays the distribution of absolute or relative prediction errors.

### Model Comparison Chart

Compares MAE and RMSE across different algorithms.

### Processor Recommendation Chart

Displays:

- CPU recommendations.
    
- GPU recommendations.
    
- Correct recommendations.
    
- Incorrect recommendations.
    
- Uncertain recommendations.
    

These visualizations help developers understand model behavior and identify areas for improvement.

## 15. Model Acceptance Criteria

Before deployment, CoreWise AI should define model acceptance criteria.

Possible criteria include:

|Evaluation Area|Acceptance Consideration|
|---|---|
|CPU MAE|Within an acceptable execution-time error|
|GPU MAE|Within an acceptable execution-time error|
|RMSE|No excessive large prediction errors|
|R²|Sufficient explanatory performance|
|Recommendation accuracy|Reliable processor selection|
|Generalization|Stable performance on unseen configurations|
|Inference latency|Fast enough for application requirements|
|Prediction uncertainty|Unreliable cases identified appropriately|

The actual numerical thresholds should be established through experiments and project requirements rather than selected arbitrarily.

## 16. Challenges and Solutions

|Challenge|Impact|Possible Solution|
|---|---|---|
|Small test dataset|Unstable evaluation|Collect more benchmark observations|
|Data leakage|Overestimated accuracy|Use group-based splitting|
|Hardware differences|Unreliable generalization|Test unseen hardware configurations|
|Noisy benchmark results|Unstable metrics|Use repeated measurements|
|Incorrect recommendations|Performance loss|Evaluate recommendation accuracy and regret|
|Similar predicted times|Uncertain decisions|Introduce a decision margin|
|Model drift|Reduced accuracy|Monitor errors and retrain|
|Different timing boundaries|Unfair comparisons|Standardize benchmark measurements|

## 17. Future Improvements

Future evaluation improvements may include:

- Cross-validation.
    
- Hardware-based holdout testing.
    
- Workload-family holdout testing.
    
- Prediction interval evaluation.
    
- Confidence calibration.
    
- Energy efficiency evaluation.
    
- Recommendation regret analysis.
    
- Continuous performance monitoring.
    
- Automated model comparison.
    
- Benchmark-based model acceptance testing.
    

### Recommendation Regret

Recommendation regret measures the additional execution time caused by choosing the slower processor.

For a selected processor:

Regret=Tselected−min⁡(TCPU,TGPU)Regret=T_{selected}-\min(T_{CPU},T_{GPU})

A regret of zero means the selected processor was the fastest under the measured conditions.

Average regret can be calculated across evaluated workloads:

AverageRegret=1N∑i=1NRegretiAverageRegret=\frac{1}{N}\sum_{i=1}^{N}Regret_i

This is useful because it measures the practical cost of incorrect recommendations rather than simply counting them.

## 18. Conclusion

Model Evaluation determines whether CoreWise AI's trained machine learning models can make reliable execution-time predictions and processor recommendations.

Regression metrics such as MAE, MSE, RMSE, and R2R^2 measure numerical prediction quality.

Recommendation accuracy, confusion matrices, speedup estimation error, and recommendation regret measure the quality and practical consequences of CPU-versus-GPU decisions.

Testing on unseen workloads and hardware configurations is essential to understand how well the model generalizes beyond its training data.

By combining numerical evaluation, real benchmark validation, and uncertainty analysis, CoreWise AI can make more reliable and evidence-based processor recommendations.

---

## Related Notes

- [[ML-Prediction-Model]]
    
- [Dataset](Dataset.md.md)
    
- [Feature-Engineering](Feature-Engineering.md.md)
    
- [Model-Training](Model-Training.md.md)
    
- [[Model-Explainability]]
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

## Key Takeaway

**Model Evaluation verifies whether CoreWise AI can accurately predict CPU and GPU execution times, generalize to unseen workloads, and recommend the processor that delivers better measured performance.**