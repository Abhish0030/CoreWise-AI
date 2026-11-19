# Model Training

## 1. Introduction

Model Training is the process through which a Machine Learning algorithm learns patterns from historical benchmark data and uses those patterns to make predictions on unseen workloads.

In CoreWise AI, the primary objective of model training is to develop a system capable of predicting CPU and GPU execution times based on workload characteristics and hardware specifications.

The model learns the relationship between:

- Workload characteristics.
    
- CPU hardware specifications.
    
- GPU hardware specifications.
    
- Actual execution-time measurements.
    

After training, the model can estimate how long a new workload may take to execute on different processors.

The overall prediction process is:

T^=fθ(X)\hat{T}=f_{\theta}(X)

Where:

- XX = input feature vector.
    
- fθf_{\theta} = trained machine learning function.
    
- θ\theta = learned model parameters.
    
- T^\hat{T} = predicted execution time.
    

## 2. Training Objectives

The training process should achieve the following objectives:

1. Learn relationships between workload features and execution time.
    
2. Predict CPU execution time accurately.
    
3. Predict GPU execution time accurately.
    
4. Minimize prediction errors.
    
5. Avoid overfitting to training data.
    
6. Generalize to unseen workloads and hardware configurations.
    
7. Produce models suitable for integration with the CoreWise AI backend.
    

## 3. Model Training Architecture

CoreWise AI follows a supervised learning workflow.

```text
       Benchmark Dataset
               |
               v
       Data Preprocessing
               |
               v
       Feature Engineering
               |
               v
        Dataset Splitting
               |
       +-------+-------+
       |       |       |
       v       v       v
    Training Validation Testing
       |       |       |
       v       v       |
    Model Training      |
       |                |
       v                |
    Hyperparameter      |
      Tuning             |
       |                |
       v                |
    Model Selection     |
       |                |
       +-------+--------+
               |
               v
        Final Evaluation
               |
               v
        Save Trained Model
               |
               v
       Backend Integration
               |
               v
      CPU/GPU Prediction
```

## 4. Dataset Preparation

Before training, the benchmark dataset must be prepared.

Each observation should contain:

- Workload features.
    
- Hardware features.
    
- Actual execution time.
    
- Workload identifier.
    
- Hardware configuration identifier.
    

The target variables are:

YCPU=TCPUY_{CPU}=T_{CPU} YGPU=TGPUY_{GPU}=T_{GPU}

Two possible training strategies can be used.

### Strategy 1: Separate Models

Train an independent model for each processor type.

CPU model:

T^CPU=fθ(XCPU)\hat{T}_{CPU}=f_{\theta}(X_{CPU})

GPU model:

T^GPU=gϕ(XGPU)\hat{T}_{GPU}=g_{\phi}(X_{GPU})

This approach allows each model to learn processor-specific performance relationships.

### Strategy 2: Unified Model

Train a single model using workload features, hardware features, and processor type.

T^=fθ(W,H,P)\hat{T}=f_{\theta}(W,H,P)

Where:

- WW = workload features.
    
- HH = hardware features.
    
- PP = processor type.
    

For the initial CoreWise AI implementation, separate models are a practical starting point because CPU and GPU architectures have different performance characteristics.

## 5. Dataset Splitting

The dataset must be divided into training, validation, and testing subsets.

An example split is:

|Dataset|Percentage|Purpose|
|---|--:|---|
|Training|70%|Learn model parameters|
|Validation|15%|Tune hyperparameters|
|Testing|15%|Evaluate final model|

### 5.1 Training Dataset

The training dataset provides examples from which the model learns.

For each observation:

(Xi,Yi)(X_i,Y_i)

Where:

- XiX_i = input feature vector.
    
- YiY_i = actual execution time.
    

The model compares its prediction with the actual value and adjusts its parameters.

### 5.2 Validation Dataset

The validation dataset helps determine which model configuration performs better.

It is used for:

- Hyperparameter tuning.
    
- Model selection.
    
- Early stopping, where applicable.
    
- Overfitting detection.
    

### 5.3 Testing Dataset

The test dataset is reserved for final evaluation.

It should not be used to repeatedly adjust model parameters.

For CoreWise AI, group-based splitting is important. Related benchmark measurements should not be randomly distributed across training and testing if doing so allows the model to memorize nearly identical workload and hardware configurations.

To test generalization to unseen hardware, entire hardware configurations can be held out.

## 6. Model Selection

CoreWise AI can experiment with several regression algorithms.

### 6.1 Linear Regression

Linear Regression provides a simple baseline.

Its mathematical representation is:

Y^=β0+β1X1+β2X2+⋯+βnXn\hat{Y}=\beta_0+\beta_1X_1+\beta_2X_2+\cdots+\beta_nX_n

The model learns coefficients that minimize prediction error.

Advantages:

- Simple to implement.
    
- Fast to train.
    
- Easy to interpret.
    
- Useful as a baseline.
    

Limitation:

- May not capture complex nonlinear hardware-performance relationships.
    

### 6.2 Random Forest Regression

Random Forest combines multiple decision trees.

The final prediction is calculated by averaging individual tree predictions:

Y^=1M∑i=1MTi(X)\hat{Y}=\frac{1}{M}\sum_{i=1}^{M}T_i(X)

Where:

- MM = number of trees.
    
- Ti(X)T_i(X) = prediction from the ithi^{th} tree.
    

Advantages:

- Captures nonlinear relationships.
    
- Handles interactions between features.
    
- Provides feature-importance information.
    
- Usually works well with structured datasets.
    

### 6.3 XGBoost Regression

XGBoost builds decision trees sequentially to improve prediction performance.

Its prediction function is:

Y^i=∑k=1Kfk(Xi)\hat{Y}_i=\sum_{k=1}^{K}f_k(X_i)

Where:

- KK = number of trees.
    
- fkf_k = prediction from the kthk^{th} tree.
    

The objective function can be represented as:

Obj=L(Y^,Y)+Ω(F)Obj=L(\hat{Y},Y)+\Omega(F)

Where:

- LL = prediction loss.
    
- Ω(F)\Omega(F) = regularization term.
    
- FF = collection of trees.
    

Advantages:

- Captures complex relationships.
    
- Supports regularization.
    
- Performs well on many structured datasets.
    
- Supports feature-importance analysis.
    

### 6.4 Neural Network Regression

Neural networks can learn complex relationships between multiple input features.

A simple feed-forward network performs:

h1=σ(W1X+b1)h_1=\sigma(W_1X+b_1) h2=σ(W2h1+b2)h_2=\sigma(W_2h_1+b_2) Y^=W3h2+b3\hat{Y}=W_3h_2+b_3

Where:

- XX = input feature vector.
    
- WW = weight matrices.
    
- bb = bias vectors.
    
- σ\sigma = activation function.
    
- h1,h2h_1,h_2 = hidden-layer outputs.
    

Neural networks may become useful when CoreWise AI has a sufficiently large and diverse dataset.

### Recommended Initial Model

Start with:

1. Linear Regression as a baseline.
    
2. Random Forest as a nonlinear model.
    
3. XGBoost as a gradient-boosting candidate.
    

Compare their validation performance before selecting a final model.

Do not assume that a more complex algorithm will automatically provide better predictions.

## 7. Loss Functions

A loss function measures how different the model's predictions are from actual execution times.

The training algorithm attempts to minimize this loss.

### 7.1 Mean Squared Error

Mean Squared Error is a common regression loss function.

MSE=1N∑i=1N(Yi−Y^i)2MSE=\frac{1}{N}\sum_{i=1}^{N}(Y_i-\hat{Y}_i)^2

Where:

- NN = number of observations.
    
- YiY_i = actual execution time.
    
- Y^i\hat{Y}_i = predicted execution time.
    

A larger prediction error receives a greater penalty because the error is squared.

### 7.2 Mean Absolute Error

MAE=1N∑i=1N∣Yi−Y^i∣MAE=\frac{1}{N}\sum_{i=1}^{N}|Y_i-\hat{Y}_i|

MAE calculates the average absolute prediction error.

It is easier to interpret because it uses the same unit as the target execution time.

### 7.3 Huber Loss

Huber Loss combines characteristics of MSE and MAE.

Lδ(e)={12e2∣e∣≤δδ(∣e∣−12δ)∣e∣>δL_{\delta}(e)= \begin{cases} \frac{1}{2}e^2 & |e|\leq\delta\\ \delta(|e|-\frac{1}{2}\delta) & |e|>\delta \end{cases}

Where:

- e=Y−Y^e=Y-\hat{Y}.
    
- δ\delta = transition threshold.
    

It behaves quadratically for small errors and linearly for large errors.

This can be useful when benchmark measurements contain occasional large deviations.

## 8. Model Optimization

Optimization is the process of adjusting model parameters to reduce prediction errors.

### 8.1 Gradient Descent

Gradient Descent updates model parameters in the direction that reduces the loss function.

The update rule is:

θnew=θold−η∇θL(θ)\theta_{new}=\theta_{old}-\eta\nabla_{\theta}L(\theta)

Where:

- θ\theta = model parameters.
    
- η\eta = learning rate.
    
- ∇θL\nabla_{\theta}L = gradient of the loss function.
    

The learning rate controls the size of each parameter update.

A very high learning rate may prevent stable convergence, while a very low learning rate may make training slow.

Gradient-based optimization is particularly relevant to neural networks.

Tree-based models such as Random Forest and XGBoost use their own training procedures rather than ordinary neural-network gradient-descent updates.

### 8.2 Regularization

Regularization helps reduce overfitting by controlling model complexity.

For example, L2 regularization adds a penalty to large model coefficients:

Lregularized=Loriginal+λ∑j=1nθj2L_{regularized}=L_{original}+\lambda\sum_{j=1}^{n}\theta_j^2

Where:

- λ\lambda = regularization strength.
    
- θj\theta_j = model parameters.
    

Regularization methods vary depending on the selected algorithm.

## 9. Hyperparameter Tuning

Hyperparameters are settings selected before or during model training.

They control how an algorithm learns.

Examples:

|Algorithm|Hyperparameter|Purpose|
|---|---|---|
|Random Forest|n_estimators|Number of trees|
|Random Forest|max_depth|Maximum tree depth|
|Random Forest|min_samples_split|Minimum samples required for splitting|
|XGBoost|learning_rate|Contribution of each new tree|
|XGBoost|max_depth|Maximum tree depth|
|XGBoost|n_estimators|Number of boosting rounds|
|Neural Network|learning_rate|Optimization step size|
|Neural Network|epochs|Number of training iterations|
|Neural Network|batch_size|Samples processed per update|

### Grid Search

Grid Search evaluates combinations of selected hyperparameters.

For example:

```python
param_grid = {
    "n_estimators": [100, 200, 300],
    "max_depth": [5, 10, 15],
    "min_samples_split": [2, 5, 10]
}
```

The best configuration is selected using validation performance or cross-validation within the training data.

### Random Search

Random Search evaluates randomly selected combinations from a defined search space.

It can be more efficient than Grid Search when many hyperparameters are involved.

## 10. Overfitting and Underfitting

### 10.1 Overfitting

Overfitting occurs when a model learns the training data too closely, including noise and accidental patterns.

Characteristics:

- Very low training error.
    
- High validation error.
    
- Poor performance on unseen workloads.
    

Possible solutions:

- Increase training data diversity.
    
- Reduce model complexity.
    
- Apply regularization.
    
- Tune hyperparameters.
    
- Use appropriate group-based validation.
    

### 10.2 Underfitting

Underfitting occurs when a model is too simple to learn the underlying relationships.

Characteristics:

- High training error.
    
- High validation error.
    
- Poor prediction performance.
    

Possible solutions:

- Use more informative features.
    
- Increase model complexity.
    
- Improve feature engineering.
    
- Reduce excessive regularization.
    
- Select a more suitable algorithm.
    

### 10.3 Bias-Variance Trade-off

Model performance depends partly on the balance between bias and variance.

- High bias: model is too simple.
    
- High variance: model is too sensitive to training data.
    

The objective is to achieve a suitable balance so that the model performs well on unseen workloads.

## 11. Model Training Using Python

The following example demonstrates how a Random Forest regression model can be trained using benchmark data.

Assume that a CSV file named `benchmark_dataset.csv` contains workload features and an actual CPU execution-time column.

```python
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.metrics import mean_squared_error, r2_score

import joblib

# Load benchmark dataset
df = pd.read_csv("benchmark_dataset.csv")

# Select input features
features = [
    "input_size",
    "operation_count",
    "parallel_fraction",
    "arithmetic_intensity",
    "memory_bandwidth"
]

X = df[features]

# Select target variable
y = df["cpu_execution_time_ms"]

# Split the dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)

# Initialize model
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=10,
    random_state=42
)

# Train model
model.fit(X_train, y_train)

# Generate predictions
predictions = model.predict(X_test)

# Evaluate model
mae = mean_absolute_error(y_test, predictions)

mse = mean_squared_error(y_test, predictions)

rmse = mse ** 0.5

r2 = r2_score(y_test, predictions)

print("MAE:", mae)
print("RMSE:", rmse)
print("R2 Score:", r2)

# Save trained model
joblib.dump(model, "cpu_prediction_model.pkl")
```

**Important:** This is an illustrative training example. It assumes that the CSV contains valid benchmark measurements and that the listed feature columns exist. It uses a random split for simplicity; a group-based split should be used when related workload or hardware configurations could leak across partitions.

A separate model can be trained for GPU execution time by changing the target column and using the appropriate GPU features.

## 12. Model Evaluation

After training, evaluate the model using previously unseen test data.

### 12.1 Mean Absolute Error

MAE=1N∑i=1N∣Yi−Y^i∣MAE=\frac{1}{N}\sum_{i=1}^{N}|Y_i-\hat{Y}_i|

It indicates the average absolute difference between predicted and actual execution times.

### 12.2 Root Mean Squared Error

RMSE=1N∑i=1N(Yi−Y^i)2RMSE=\sqrt{\frac{1}{N}\sum_{i=1}^{N}(Y_i-\hat{Y}_i)^2}

It penalizes larger prediction errors more strongly.

### 12.3 Coefficient of Determination

R2=1−∑(Yi−Y^i)2∑(Yi−Yˉ)2R^2=1-\frac{\sum(Y_i-\hat{Y}_i)^2} {\sum(Y_i-\bar{Y})^2}

It measures how much variation in the target is explained by the model.

### Model Comparison

|Model|MAE|RMSE|R²|
|---|--:|--:|--:|
|Linear Regression|To be measured|To be measured|To be measured|
|Random Forest|To be measured|To be measured|To be measured|
|XGBoost|To be measured|To be measured|To be measured|
|Neural Network|To be measured|To be measured|To be measured|

The values must be populated after actual model experiments. No performance result should be assumed before testing.

## 13. Model Saving and Versioning

After selecting the final model, save it for future use.

For Scikit-learn models:

```python
import joblib

joblib.dump(model, "corewise_cpu_model.pkl")

loaded_model = joblib.load("corewise_cpu_model.pkl")
```

The same process can be used for a GPU prediction model.

Along with each model, maintain:

- Model version.
    
- Training dataset version.
    
- Feature names and order.
    
- Preprocessing configuration.
    
- Training date.
    
- Evaluation metrics.
    
- Supported workload types.
    
- Supported hardware configurations.
    

The preprocessing pipeline must be saved with the model or reproduced exactly during inference.

This prevents differences between training-time and production-time feature processing.

## 14. Integration with CoreWise AI

The trained models can be integrated into the backend through a prediction service.

### Workflow

```text
       User Submits Workload
                |
                v
         Backend API
                |
                v
       Input Validation
                |
                v
       Feature Engineering
                |
                v
        Preprocessing
                |
          +-----+-----+
          |           |
          v           v
       CPU Model   GPU Model
          |           |
          v           v
      CPU Time     GPU Time
          |           |
          +-----+-----+
                |
                v
       Recommendation Engine
                |
                v
         Agentic AI Layer
                |
                v
        Frontend Results
```

### Example Prediction Response

```json
{
  "workload": "Matrix Multiplication",
  "cpu_execution_time_ms": 120,
  "gpu_execution_time_ms": 30,
  "estimated_speedup": 4.0,
  "recommended_processor": "GPU",
  "prediction_status": "estimated"
}
```

The response is illustrative. Actual values must come from the deployed models.

## 15. Model Monitoring and Retraining

A trained model may become less accurate when hardware, software, or workload characteristics change.

CoreWise AI should monitor prediction performance over time.

After execution, compare predicted and actual values.

Error=Yactual−YpredictedError=Y_{actual}-Y_{predicted}

Absolute error:

AbsoluteError=∣Yactual−Ypredicted∣AbsoluteError=|Y_{actual}-Y_{predicted}|

Relative error:

RelativeError=∣Yactual−Ypredicted∣Yactual×100RelativeError= \frac{|Y_{actual}-Y_{predicted}|} {Y_{actual}}\times100

Relative error should be handled carefully when actual execution time is zero or very small.

### Retraining Triggers

Possible triggers include:

- Consistently increasing prediction errors.
    
- New CPU or GPU hardware.
    
- New workload categories.
    
- Major compiler or driver changes.
    
- New benchmark dataset availability.
    
- Changes in execution environments.
    

Retraining should be followed by validation and testing before the new model replaces the production model.

## 16. Challenges and Solutions

|Challenge|Impact|Possible Solution|
|---|---|---|
|Small dataset|Poor generalization|Collect more benchmark observations|
|Overfitting|Weak unseen-data performance|Regularization and group-based validation|
|Inconsistent measurements|Unreliable targets|Controlled repeated benchmarking|
|Hardware diversity|Difficult generalization|Include diverse configurations|
|Feature mismatch|Incorrect inference|Version preprocessing with the model|
|Hyperparameter selection|Suboptimal model|Systematic tuning|
|Model drift|Decreasing accuracy|Monitor errors and retrain|
|High inference latency|Slow recommendations|Optimize model size and serving process|

## 17. Future Improvements

Future training improvements may include:

- Online learning from new benchmark results.
    
- Automated hyperparameter optimization.
    
- Hardware-specific model selection.
    
- Ensemble regression models.
    
- Neural network-based performance prediction.
    
- Prediction intervals and uncertainty estimation.
    
- Energy consumption prediction.
    
- Explainable model training with SHAP.
    
- Automated model evaluation and version management.
    

These improvements can be added as the dataset and benchmarking infrastructure mature.

## 18. Conclusion

Model Training transforms the benchmark dataset into an intelligent prediction system.

CoreWise AI uses supervised regression algorithms to learn the relationship between workload characteristics, hardware specifications, and actual execution times.

The training process includes dataset preparation, model selection, loss minimization, hyperparameter tuning, validation, testing, and model deployment.

By training separate CPU and GPU execution-time prediction models, CoreWise AI can estimate the expected performance of a workload on both processors.

These predictions become the foundation of the recommendation engine, while the Agentic AI layer communicates the results and explains the recommendation using available evidence.

---

## Related Notes

- [[ML-Prediction-Model]]
    
- [Dataset](Dataset.md.md)
    
- [Feature-Engineering](Feature-Engineering.md.md)
    
- [Model-Evaluation](Model-Evaluation.md.md)
    
- [[Model-Explainability]]
    
- [Execution-Time](../03-Mathematics/Execution-Time.md.md)
    
- [Speedup](../03-Mathematics/Speedup.md.md)
    
- [Performance-Metrics](../03-Mathematics/Performance-Metrics.md.md)
    
- [[CoreWise-AI-System-Architecture]]
    

## Key Takeaway

**Model Training enables CoreWise AI to learn from historical benchmark measurements, predict CPU and GPU execution times, and provide data-driven processor recommendations.**