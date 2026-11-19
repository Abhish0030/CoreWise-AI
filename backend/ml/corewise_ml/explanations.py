"""Real SHAP on fitted transformed features in the regressors' log-millisecond space."""

import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from xgboost import XGBRegressor

from .schema import Features, Record, TrainingConfig
from .training import CATEGORICAL, CPU, GPU, data_digest, grouped_split, load_artifact

POLICY_VERSION = "cw-shap-1"


def sample_indices(indices, limit, seed):
    indices = np.asarray(indices, dtype=int)
    if len(indices) <= limit:
        return sorted(indices.tolist())
    return sorted(np.random.default_rng(seed).choice(indices, limit, replace=False).tolist())


def prepare_context(model: dict, dataset: dict, directory: Path, background_limit: int):
    if not 8 <= background_limit <= 128:
        raise ValueError("Background sample limit must be between 8 and 128")
    bundle = load_artifact(model, directory)
    rows = [Record.model_validate(row).model_dump() for row in dataset["rows"]]
    if dataset["version"] != rows[0]["dataset_version"]:
        raise ValueError("Training dataset version metadata does not match its records")
    frame = pd.DataFrame(rows).replace({None: np.nan})
    config = TrainingConfig.model_validate(model["trainingConfig"])
    training, _, test, _ = grouped_split(frame, config)
    digest = data_digest(rows)
    stored = bundle.get("trainingReference")
    if stored and (
        stored["datasetSha256"] != digest
        or stored["trainIndices"] != training.tolist()
        or stored["testIndices"] != test.tolist()
        or stored["config"] != config.model_dump()
    ):
        raise ValueError("Training dataset or split no longer matches the fitted artifact")
    if dataset["id"] != model["datasetId"] or dataset["provenance"] != model["provenance"]:
        raise ValueError("Dataset identity/provenance does not match the model registry")
    pipeline = bundle["pipeline"].regressor_
    preprocessor = pipeline.named_steps["features"]
    regressor = pipeline.named_steps["regressor"]
    if bundle["pipeline"].func is not np.log or bundle["pipeline"].inverse_func is not np.exp:
        raise ValueError("Unsupported target transformation; expected log/exp execution time")
    expected_algorithm = (
        "LINEAR"
        if isinstance(regressor, LinearRegression)
        else "RANDOM_FOREST"
        if isinstance(regressor, RandomForestRegressor)
        else "XGBOOST"
        if isinstance(regressor, XGBRegressor)
        else None
    )
    if model["algorithm"] != expected_algorithm:
        raise ValueError("Registry algorithm does not match its fitted artifact")
    numeric = CPU if model["target"] == "CPU" else GPU
    # Build the actual fitted output mapping; never assume one input equals one output.
    imputer = preprocessor.named_transformers_["numeric"].named_steps["impute"]
    numeric_names = imputer.get_feature_names_out(numeric).tolist()
    originals = list(numeric)
    originals.extend(numeric[i] for i in imputer.indicator_.features_)
    numeric_slice = preprocessor.output_indices_["numeric"]
    if numeric_slice.stop - numeric_slice.start != len(originals):
        raise ValueError("Unsupported fitted numeric transformation shape")
    encoder = preprocessor.named_transformers_["category"]
    category_names = encoder.get_feature_names_out(CATEGORICAL).tolist()
    category_originals = [
        column for column, values in zip(CATEGORICAL, encoder.categories_) for _ in values
    ]
    names = preprocessor.get_feature_names_out().tolist()
    mapping = [
        {"transformed": "numeric__" + name, "feature": original}
        for name, original in zip(numeric_names, originals)
    ]
    mapping += [
        {"transformed": "category__" + name, "feature": original}
        for name, original in zip(category_names, category_originals)
    ]
    if [m["transformed"] for m in mapping] != names:
        raise ValueError("Unsupported fitted categorical transformation mapping")
    indices = sample_indices(training, background_limit, config.seed + 505)
    background = np.asarray(preprocessor.transform(frame.iloc[indices]), dtype=float)
    if isinstance(regressor, LinearRegression):
        explainer = shap.LinearExplainer(
            regressor, shap.maskers.Independent(background, max_samples=background_limit)
        )
        explainer_type = "LinearExplainer / independent transformed features"
    elif isinstance(regressor, (RandomForestRegressor, XGBRegressor)):
        explainer = shap.TreeExplainer(
            regressor,
            data=shap.maskers.Independent(background, max_samples=background_limit),
            feature_perturbation="interventional",
            model_output="raw",
        )
        explainer_type = "TreeExplainer / interventional transformed features"
    else:
        raise ValueError("Unsupported fitted regressor; no unbounded fallback is enabled")
    reference = {
        "datasetId": dataset["id"],
        "datasetVersion": dataset["version"],
        "datasetProvenance": dataset["provenance"],
        "datasetSha256": digest,
        "schemaVersion": model["schemaVersion"],
        "splitStrategy": config.group_by,
        "trainingSeed": config.seed,
        "samplingSeed": config.seed + 505,
        "trainingRowIndices": indices,
        "sampleSize": len(indices),
        "referenceSha256": data_digest({"dataset": digest, "indices": indices}),
        "binding": "ARTIFACT_AND_REGISTRY" if stored else "LEGACY_REGISTRY_SPLIT_RECONSTRUCTION",
        "definition": "Expected raw log(time in ms) over an independent/interventional "
        "masker on deterministic training-only transformed background rows",
    }
    metadata = {
        "modelId": model["id"],
        "modelVersion": model["version"],
        "artifactSha256": model["sha256"],
        "target": model["target"],
        "algorithm": model["algorithm"],
        "datasetId": dataset["id"],
        "datasetVersion": dataset["version"],
        "datasetProvenance": dataset["provenance"],
        "featureSchemaVersion": model["schemaVersion"],
        "explainerType": explainer_type,
        "shapVersion": shap.__version__,
        "policyVersion": POLICY_VERSION,
    }
    return {
        "bundle": bundle,
        "frame": frame,
        "testIndices": test,
        "config": config,
        "preprocessor": preprocessor,
        "regressor": regressor,
        "explainer": explainer,
        "mapping": mapping,
        "background": reference,
        "model": metadata,
    }


def calculate(context, frame):
    transformed = np.asarray(context["preprocessor"].transform(frame), dtype=float)
    explanation = context["explainer"](transformed)
    values = np.asarray(explanation.values, dtype=float)
    bases = np.broadcast_to(np.asarray(explanation.base_values, dtype=float), (len(frame),))
    raw = np.asarray(context["regressor"].predict(transformed), dtype=float)
    reconstructed = bases + values.sum(axis=1)
    residual = raw - reconstructed
    tolerance = np.maximum(1e-5, np.abs(raw) * 2e-6)
    if values.shape != (len(frame), len(context["mapping"])):
        raise ValueError("Explainer returned incompatible transformed feature dimensions")
    if not np.isfinite(values).all() or not np.isfinite(bases).all():
        raise ValueError("Explainer returned nonfinite values")
    if (np.abs(residual) > tolerance).any():
        raise ValueError("SHAP additive consistency check failed; explanation was not saved")
    return values, bases, raw, residual, tolerance


def grouped(context, values):
    groups = defaultdict(lambda: np.zeros(values.shape[0]))
    for i, mapping in enumerate(context["mapping"]):
        groups[mapping["feature"]] += values[:, i]
    return groups


def explain_local(
    model, dataset, features, directory, background_limit=32, repetitions=1, saved_time_ms=None
):
    if not isinstance(repetitions, int) or not 1 <= repetitions <= 10000:
        raise ValueError("Saved workload repetition count is invalid")
    features = Features.model_validate(features).model_dump()
    context = prepare_context(model, dataset, directory, background_limit)
    for field, categories in context["bundle"]["categories"].items():
        if features[field] not in categories:
            raise ValueError(f"Prediction has unsupported {field} for its saved model")
    frame = pd.DataFrame([features]).replace({None: np.nan})
    values, bases, raw, residual, tolerance = calculate(context, frame)
    predicted_ms = float(context["bundle"]["pipeline"].predict(frame)[0]) * repetitions
    if saved_time_ms is not None and not math.isclose(
        predicted_ms, saved_time_ms, rel_tol=2e-5, abs_tol=0
    ):
        raise ValueError("Fitted prediction does not match the saved prediction/model version")
    baseline = float(bases[0]) + math.log(repetitions)
    final = float(raw[0]) + math.log(repetitions)
    contributions = [
        {
            "feature": name,
            "value": float(phi[0]),
            "direction": "INCREASE" if phi[0] > 0 else "DECREASE" if phi[0] < 0 else "NEUTRAL",
            "magnitude": abs(float(phi[0])),
        }
        for name, phi in grouped(context, values).items()
    ]
    contributions.sort(key=lambda c: c["magnitude"], reverse=True)
    summaries = [
        f"{c['feature']} {'increased' if c['value'] > 0 else 'reduced'} modeled log-time "
        f"relative to this baseline ({c['value']:+.6g} ln(ms))."
        for c in contributions[:3]
        if c["value"] != 0
    ]
    return {
        "model": context["model"],
        "background": context["background"],
        "outputSpace": "LOG_TIME_MS",
        "contributionUnits": "ln(ms)",
        "baselineOutput": baseline,
        "baselineReferenceMs": float(np.exp(baseline)),
        "finalOutput": final,
        "predictedTimeMs": predicted_ms,
        "savedPredictionTimeMs": saved_time_ms,
        "repetitions": repetitions,
        "reconstructedOutput": baseline + sum(c["value"] for c in contributions),
        "additivity": {
            "passed": True,
            "residual": float(residual[0]),
            "tolerance": float(tolerance[0]),
        },
        "contributions": contributions,
        "transformedContributions": [
            {**m, "value": float(values[0, i])} for i, m in enumerate(context["mapping"])
        ],
        "summary": summaries,
        "limitations": limitations(dataset["provenance"]),
    }


def limitations(provenance):
    return [
        "SHAP describes the fitted model, not causality or measured performance.",
        "Attributions use independent/interventional masking in transformed space; "
        "correlated inputs and one-hot combinations can leave the observed data manifold.",
        "Original-feature bars sum their transformed dimensions; grouped bars are not a new "
        "coalitional SHAP calculation on original features.",
        "Contributions are log-time, not additive milliseconds. exp(baseline) is a geometric "
        "reference time, not the arithmetic mean predicted time.",
        "CPU and GPU models have separate baselines; no speedup attribution is inferred.",
        "Synthetic-trained explanations are demonstrations, not real-world accuracy evidence."
        if provenance == "SYNTHETIC_DEMO"
        else "Measured dataset source/capability metadata remains uploader-attested.",
    ]


def explain_global(model, dataset, directory, background_limit=32, sample_limit=32, family=None):
    if not 2 <= sample_limit <= 128:
        raise ValueError("Evaluation sample limit must be between 2 and 128")
    context = prepare_context(model, dataset, directory, background_limit)
    eligible = context["testIndices"]
    if family:
        eligible = [i for i in eligible if context["frame"].iloc[i].workload_family == family]
    if len(eligible) < 2:
        raise ValueError("At least two held-out evaluation rows are required for this family")
    indices = sample_indices(eligible, sample_limit, context["config"].seed + 506)
    values, bases, _, residual, tolerance = calculate(context, context["frame"].iloc[indices])
    importance = [
        {"feature": name, "meanAbsShap": float(np.mean(np.abs(phi)))}
        for name, phi in grouped(context, values).items()
    ]
    importance.sort(key=lambda f: f["meanAbsShap"], reverse=True)
    importance = [{**entry, "rank": i + 1} for i, entry in enumerate(importance)]
    return {
        "model": context["model"],
        "background": context["background"],
        "outputSpace": "LOG_TIME_MS",
        "contributionUnits": "ln(ms)",
        "baselineOutput": float(bases[0]),
        "importance": importance,
        "evaluation": {
            "sampleSize": len(indices),
            "rowIndices": indices,
            "samplingSeed": context["config"].seed + 506,
            "split": "HELD_OUT_TEST",
            "workloadFamily": family,
            "families": context["frame"]
            .iloc[indices]
            .workload_family.value_counts()
            .astype(int)
            .to_dict(),
        },
        "transformedMapping": context["mapping"],
        "additivity": {
            "passed": True,
            "maxAbsResidual": float(np.max(np.abs(residual))),
            "maxTolerance": float(np.max(tolerance)),
        },
        "limitations": limitations(dataset["provenance"]),
    }


def serializable(result):
    json.dumps(result, allow_nan=False)
    return result
