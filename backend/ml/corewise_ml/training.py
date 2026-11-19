import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

from .datasets import validate_rows
from .schema import SCHEMA_VERSION, Record, TrainingConfig

COMMON = [
    "workload_size",
    "operation_count",
    "arithmetic_intensity",
    "parallel_fraction",
    "memory_mib",
]
CPU = COMMON + ["cpu_cores", "cpu_frequency_ghz", "cpu_gflops", "cpu_bandwidth_gbps"]
# GPU end-to-end path includes serial host work, so host capabilities are explicit features too.
GPU = CPU + [
    "transfer_mib",
    "gpu_gflops",
    "gpu_bandwidth_gbps",
    "gpu_memory_gb",
    "transfer_bandwidth_gbps",
    "launch_overhead_us",
]
CATEGORICAL = ["workload_type", "workload_unit", "precision"]
PACKAGES = ["scikit-learn", "xgboost", "numpy", "pandas", "joblib"]


def versions():
    return {name: importlib.metadata.version(name) for name in PACKAGES}


def data_digest(rows):
    return hashlib.sha256(
        json.dumps(rows, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def grouped_split(frame: pd.DataFrame, config: TrainingConfig):
    if config.group_by == "WORKLOAD_FAMILY":
        groups = frame.workload_family
    elif config.group_by == "HARDWARE":
        groups = frame.hardware_id
    else:
        # Same workload/hardware/precision repeats must remain in the same split.
        columns = [
            "hardware_id",
            "workload_family",
            *COMMON,
            "transfer_mib",
            "precision",
            "workload_unit",
        ]
        groups = frame[columns].astype(str).agg("|".join, axis=1)
    if groups.nunique() < 6:
        raise ValueError(
            "Grouped evaluation requires at least 6 distinct groups; no random fallback"
        )
    trainval, test = next(
        GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=config.seed).split(
            frame, groups=groups
        )
    )
    a, b = next(
        GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=config.seed + 1).split(
            frame.iloc[trainval], groups=groups.iloc[trainval]
        )
    )
    train, validation = trainval[a], trainval[b]
    for indices in [train, validation, test]:
        if len(indices) < 2:
            raise ValueError("Insufficient samples in a grouped split")
    return train, validation, test, groups


def make_model(target: str, algorithm: str, seed: int):
    numeric = CPU if target == "CPU" else GPU
    preprocess = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        (
                            "impute",
                            SimpleImputer(
                                strategy="median", add_indicator=True, keep_empty_features=True
                            ),
                        ),
                        ("log1p", FunctionTransformer(np.log1p, feature_names_out="one-to-one")),
                        ("scale", StandardScaler()),
                    ]
                ),
                numeric,
            ),
            ("category", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ]
    )
    algorithms = {
        "LINEAR": LinearRegression(),
        "RANDOM_FOREST": RandomForestRegressor(
            n_estimators=100, min_samples_leaf=2, random_state=seed, n_jobs=1
        ),
        "XGBOOST": XGBRegressor(
            n_estimators=160,
            max_depth=4,
            learning_rate=0.06,
            objective="reg:squarederror",
            random_state=seed,
            n_jobs=1,
        ),
    }
    pipeline = Pipeline([("features", preprocess), ("regressor", algorithms[algorithm])])
    return TransformedTargetRegressor(regressor=pipeline, func=np.log, inverse_func=np.exp)


def metrics(actual, predicted):
    if not np.isfinite(predicted).all() or (predicted <= 0).any():
        raise ValueError("Model produced nonfinite or nonpositive predictions")
    return {
        "maeMs": float(mean_absolute_error(actual, predicted)),
        "rmseMs": float(root_mean_squared_error(actual, predicted)),
        "r2": float(r2_score(actual, predicted)),
    }


def atomic_artifact(bundle, directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    model_id = str(uuid4())
    path = directory / f"{model_id}.joblib"
    temporary = directory / f"{model_id}.tmp"
    try:
        joblib.dump(bundle, temporary, compress=3)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return model_id, hashlib.sha256(path.read_bytes()).hexdigest()


def train(
    rows: list[dict], config: TrainingConfig, directory: Path, log=lambda _: None, created=None
):
    rows = [Record.model_validate(row).model_dump() for row in rows]
    validate_rows(rows)
    frame = pd.DataFrame(rows)
    # Convert nullable optional values to NaN consistently at training/inference.
    frame = frame.replace({None: np.nan})
    tr, va, te, groups = grouped_split(frame, config)
    training_reference = {
        "datasetSha256": data_digest(rows),
        "config": config.model_dump(),
        "trainIndices": tr.tolist(),
        "testIndices": te.tolist(),
    }
    split = {
        "strategy": config.group_by,
        "seed": config.seed,
        "trainRows": len(tr),
        "validationRows": len(va),
        "testRows": len(te),
        "trainGroups": int(groups.iloc[tr].nunique()),
        "validationGroups": int(groups.iloc[va].nunique()),
        "testGroups": int(groups.iloc[te].nunique()),
        "groupOverlap": False,
    }
    results = []
    for target in ["CPU", "GPU"]:
        y = frame[f"{target.lower()}_time_ms"]
        candidates = []
        for algorithm in dict.fromkeys(config.algorithms):
            log(f"Fitting {target} {algorithm} on {len(tr)} training records")
            model = make_model(target, algorithm, config.seed)
            model.fit(frame.iloc[tr], y.iloc[tr])
            validation = metrics(y.iloc[va], model.predict(frame.iloc[va]))
            candidates.append((algorithm, model, validation))
        winner = min(candidates, key=lambda entry: entry[2]["rmseMs"])[0]
        # Selection is frozen before any held-out test evaluation. No test-driven tuning/refit.
        for algorithm, model, validation in candidates:
            prediction = model.predict(frame.iloc[te])
            evaluation = metrics(y.iloc[te], prediction)
            points = [
                {
                    "actualMs": float(actual),
                    "predictedMs": float(pred),
                    "residualMs": float(actual - pred),
                    "family": str(family),
                }
                for actual, pred, family in zip(
                    y.iloc[te], prediction, frame.workload_family.iloc[te]
                )
            ]
            per_family = {}
            for family in frame.workload_family.iloc[te].unique():
                mask = frame.workload_family.iloc[te] == family
                selected = [p for p in points if p["family"] == family]
                per_family[str(family)] = {
                    "count": len(selected),
                    "maeMs": float(np.mean([abs(p["residualMs"]) for p in selected])),
                    "rmseMs": float(np.sqrt(np.mean([p["residualMs"] ** 2 for p in selected]))),
                    "r2": float(r2_score(y.iloc[te][mask], prediction[mask]))
                    if mask.sum() > 1
                    else None,
                }
            numeric = CPU if target == "CPU" else GPU
            ranges = {
                name: [float(frame.iloc[tr][name].min()), float(frame.iloc[tr][name].max())]
                for name in numeric
                if frame.iloc[tr][name].notna().any()
            }
            bundle = {
                "pipeline": model,
                "schemaVersion": SCHEMA_VERSION,
                "target": target,
                "versions": versions(),
                "ranges": ranges,
                "categories": {c: frame.iloc[tr][c].unique().tolist() for c in CATEGORICAL},
                "trainingReference": training_reference,
            }
            model_id, digest = atomic_artifact(bundle, directory)
            if created is not None:
                created.append({"id": model_id})
            results.append(
                {
                    "id": model_id,
                    "target": target,
                    "algorithm": algorithm,
                    "sha256": digest,
                    "selected": algorithm == winner,
                    "evaluation": {
                        "validation": validation,
                        "test": evaluation,
                        "perFamily": per_family,
                        "points": points,
                        "split": split,
                        "selectionMetric": "validation RMSE in milliseconds",
                        "versions": versions(),
                        "provenance": rows[0]["provenance"],
                        "label": "Synthetic validation results — not real-world benchmark accuracy."
                        if rows[0]["provenance"] == "SYNTHETIC_DEMO"
                        else "Uploader-attested measured labels; not independently verified.",
                    },
                    "featureSchema": {
                        "version": SCHEMA_VERSION,
                        "numeric": numeric,
                        "categorical": CATEGORICAL,
                        "categories": {
                            key: sorted(frame.iloc[tr][key].unique().tolist())
                            for key in CATEGORICAL
                        },
                        "ranges": ranges,
                    },
                }
            )
        log(f"Selected {winner} for {target} using validation RMSE")
    # Ensure JSON is strictly serializable (reject NaN metrics).
    json.dumps(results, allow_nan=False)
    return results


def verified_artifact_path(model: dict, directory: Path):
    # No client-supplied paths. Only UUID filenames from the worker's registry, under private root.
    from uuid import UUID

    model_id = str(UUID(model["id"]))
    if model.get("version", model_id) != model_id:
        raise ValueError("Registry model version does not match its artifact identity")
    path = directory.resolve() / f"{model_id}.joblib"
    if path.resolve().parent != directory.resolve():
        raise ValueError("Artifact path escaped the trusted model directory")
    if not path.is_file():
        raise ValueError("Trusted model artifact is missing; retrain this version")
    if hashlib.sha256(path.read_bytes()).hexdigest() != model["sha256"]:
        raise ValueError("Model artifact integrity check failed")
    return path


def load_artifact(model: dict, directory: Path):
    path = verified_artifact_path(model, directory)
    # Hash the exact bytes passed to the deserializer; avoid a check/load race.
    from io import BytesIO

    payload = path.read_bytes()
    if hashlib.sha256(payload).hexdigest() != model["sha256"]:
        raise ValueError("Model artifact integrity changed before loading")
    bundle = joblib.load(BytesIO(payload))
    if bundle["schemaVersion"] != SCHEMA_VERSION or bundle["versions"] != versions():
        raise ValueError("Feature schema or dependency version mismatch; retrain this model")
    if model.get("schemaVersion", SCHEMA_VERSION) != SCHEMA_VERSION:
        raise ValueError("Registry feature schema mismatch")
    if bundle["target"] != model["target"]:
        raise ValueError("Registry target does not match its fitted artifact")
    return bundle


def predict_artifact(model: dict, features: dict, directory: Path):
    bundle = load_artifact(model, directory)
    for field, known in bundle["categories"].items():
        if features[field] not in known:
            raise ValueError(f"Unsupported {field}: {features[field]}; select a compatible model")
    warnings = [
        f"{key} lies outside this model's training range"
        for key, bounds in bundle["ranges"].items()
        if features[key] is not None and not bounds[0] <= features[key] <= bounds[1]
    ]
    frame = pd.DataFrame([features]).replace({None: np.nan})
    value = float(bundle["pipeline"].predict(frame)[0])
    if not np.isfinite(value) or value <= 0:
        raise ValueError("Model produced an invalid execution time")
    return value, warnings
