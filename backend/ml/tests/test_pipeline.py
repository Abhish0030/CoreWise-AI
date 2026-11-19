import csv
import hashlib
import io
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from corewise_ml.app import app
from corewise_ml.datasets import generate, validate_csv
from corewise_ml.schema import Features, Record, TrainingConfig
from corewise_ml.training import grouped_split, predict_artifact, train


def as_csv(rows):
    text = io.StringIO()
    writer = csv.DictWriter(text, fieldnames=Record.model_fields)
    writer.writeheader()
    writer.writerows(rows)
    return text.getvalue()


@pytest.fixture(scope="module")
def rows():
    return generate(240, 42)


@pytest.fixture(scope="module")
def fitted(rows, tmp_path_factory):
    directory = tmp_path_factory.mktemp("trusted-artifacts")
    results = train(rows, TrainingConfig(), directory)
    return results, directory


def test_seed_reproducibility_and_diversity(rows):
    assert rows == generate(240, 42)
    assert rows != generate(240, 43)
    assert len({r["workload_family"] for r in rows}) == 6
    assert len({r["hardware_id"] for r in rows}) == 12
    assert all(r["provenance"] == "SYNTHETIC_DEMO" for r in rows)
    assert any(r["cpu_time_ms"] < r["gpu_time_ms"] for r in rows)
    assert any(r["cpu_time_ms"] > r["gpu_time_ms"] for r in rows)


def test_valid_csv_and_optional_policy(rows):
    copy = [dict(r, cpu_frequency_ghz=None, gpu_memory_gb=None) for r in rows]
    assert len(validate_csv(as_csv(copy))) == 240
    assert validate_csv(as_csv(copy))[0]["gpu_memory_gb"] is None


@pytest.mark.parametrize(
    "field,value",
    [
        ("cpu_time_ms", 0),
        ("gpu_time_ms", -1),
        ("cpu_time_ms", "nan"),
        ("operation_count", ""),
        ("cpu_gflops", 0),
        ("parallel_fraction", 2),
        ("provenance", "ANALYTICAL"),
        ("provenance", "PREDICTED"),
        ("provenance", "USER_ENTERED"),
        ("schema_version", "unknown"),
    ],
)
def test_invalid_records(rows, field, value):
    copy = [dict(r) for r in rows]
    copy[0][field] = value
    with pytest.raises(ValueError, match="Row 2"):
        validate_csv(as_csv(copy))


def test_bad_csv_and_size(rows):
    for text in ["hello,world\n1,2", "x" * 2_000_001, as_csv(rows[:2])]:
        with pytest.raises(ValueError):
            validate_csv(text)
    text = as_csv(rows).replace("cpu_time_ms", "gpu_time_ms", 1)
    with pytest.raises(ValueError, match="Duplicate"):
        validate_csv(text)
    copy = [dict(r) for r in rows]
    copy[0]["provenance"] = "MEASURED"
    with pytest.raises(ValueError, match="mix"):
        validate_csv(as_csv(copy))


@pytest.mark.parametrize("group_by", ["CONFIGURATION", "HARDWARE", "WORKLOAD_FAMILY"])
def test_grouped_splits_no_leakage(rows, group_by):
    # Duplicated measurements cannot straddle partitions.
    frame = pd.DataFrame(rows + rows)
    a, b, c, groups = grouped_split(frame, TrainingConfig(group_by=group_by))
    assert not set(groups.iloc[a]) & set(groups.iloc[b])
    assert not set(groups.iloc[a]) & set(groups.iloc[c])
    assert not set(groups.iloc[b]) & set(groups.iloc[c])


def test_insufficient_groups_reports_failure(rows):
    frame = pd.DataFrame([dict(r, hardware_id="one-device") for r in rows])
    with pytest.raises(ValueError, match="at least 6"):
        grouped_split(frame, TrainingConfig(group_by="HARDWARE"))


def test_real_cpu_gpu_fitting_metrics_and_artifacts(fitted):
    models, directory = fitted
    assert len(models) == 6
    assert {m["algorithm"] for m in models} == {"LINEAR", "RANDOM_FOREST", "XGBOOST"}
    assert len(list(directory.glob("*.joblib"))) == 6
    for target in ["CPU", "GPU"]:
        candidates = [m for m in models if m["target"] == target]
        selected = next(m for m in candidates if m["selected"])
        assert selected["evaluation"]["validation"]["rmseMs"] == min(
            m["evaluation"]["validation"]["rmseMs"] for m in candidates
        )
    for model in models:
        assert model["evaluation"]["test"]["rmseMs"] >= 0
        assert model["evaluation"]["provenance"] == "SYNTHETIC_DEMO"
        assert "not real-world" in model["evaluation"]["label"]
        assert "cpu_time_ms" not in model["featureSchema"]["numeric"]
        assert "gpu_time_ms" not in model["featureSchema"]["numeric"]


def test_persisted_preprocessing_and_predictions(rows, fitted):
    models, directory = fitted
    features = Features.model_validate({k: rows[0][k] for k in Features.model_fields}).model_dump()
    for model in models:
        first, _ = predict_artifact(model, features, directory)
        second, _ = predict_artifact(model, features, directory)
        assert first == second and np.isfinite(first) and first > 0
        # Missing optional fields use the very same fitted pipeline.
        optional = dict(features, cpu_frequency_ghz=None, gpu_memory_gb=None)
        assert predict_artifact(model, optional, directory)[0] > 0


def test_artifact_integrity_and_schema_mismatch(rows, fitted, tmp_path):
    models, directory = fitted
    features = {k: rows[0][k] for k in Features.model_fields}
    with pytest.raises(ValueError, match="integrity"):
        predict_artifact(dict(models[0], sha256="wrong"), features, directory)
    with pytest.raises(ValueError, match="Unsupported"):
        predict_artifact(models[0], dict(features, workload_type="unknown-family"), directory)
    with pytest.raises(ValueError, match="missing"):
        predict_artifact(models[0], features, Path(tmp_path))
    with pytest.raises(ValidationError):
        Features.model_validate(dict(features, cpu_time_ms=1))


def test_internal_auth_and_validation(monkeypatch):
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "private-test-token-" * 3)
    client = TestClient(app)
    assert client.get("/health").status_code in [401, 403]
    assert client.get("/health", headers={"Authorization": "Bearer bad"}).status_code == 401
    headers = {"Authorization": "Bearer " + "private-test-token-" * 3}
    assert client.get("/health", headers=headers).status_code == 200
    assert (
        client.post(
            "/internal/datasets", headers=headers, json={"mode": "CSV", "csv": "invalid"}
        ).status_code
        == 422
    )
    assert client.post("/internal/predict", headers=headers, json={}).status_code == 422
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "replace-with-a-long-placeholder-private-token")
    assert client.get("/health", headers=headers).status_code == 503


def test_preprocessing_statistics_come_only_from_training(rows, fitted):
    models, directory = fitted
    tr, _, _, _ = grouped_split(pd.DataFrame(rows), TrainingConfig())
    model = next(m for m in models if m["target"] == "CPU")
    bundle = joblib.load(directory / f"{model['id']}.joblib")
    numeric = bundle["pipeline"].regressor_.named_steps["features"].named_transformers_["numeric"]
    expected = pd.DataFrame(rows).iloc[tr][model["featureSchema"]["numeric"]].median().to_numpy()
    assert np.allclose(numeric.named_steps["impute"].statistics_, expected)


def test_dependency_and_unit_compatibility(rows, fitted, tmp_path):
    models, directory = fitted
    model = models[0]
    features = {k: rows[0][k] for k in Features.model_fields}
    with pytest.raises(ValueError, match="workload_unit"):
        predict_artifact(model, dict(features, workload_unit="MATRIX_DIMENSION"), directory)
    bundle = joblib.load(directory / f"{model['id']}.joblib")
    bundle["versions"]["numpy"] = "unsupported"
    path = tmp_path / f"{model['id']}.joblib"
    joblib.dump(bundle, path)
    registered = dict(model, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    with pytest.raises(ValueError, match="version mismatch"):
        predict_artifact(registered, features, tmp_path)
