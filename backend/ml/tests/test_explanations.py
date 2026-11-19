import hashlib
import math

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from corewise_ml.app import app
from corewise_ml.datasets import generate
from corewise_ml.explanations import explain_global, explain_local, prepare_context
from corewise_ml.schema import Features, TrainingConfig
from corewise_ml.training import grouped_split, train


@pytest.fixture(scope="module")
def fixture(tmp_path_factory):
    rows = generate(180, 43)
    # Explicit missing values produce fitted indicator columns for mapping checks.
    for i in range(0, len(rows), 7):
        rows[i]["cpu_frequency_ghz"] = None
        rows[i]["gpu_memory_gb"] = None
    directory = tmp_path_factory.mktemp("shap-models")
    results = train(rows, TrainingConfig(seed=43), directory)
    dataset = {
        "id": "owned-synthetic-fixture",
        "version": rows[0]["dataset_version"],
        "rows": rows,
        "provenance": "SYNTHETIC_DEMO",
    }
    models = [
        {
            **m,
            "version": m["id"],
            "datasetId": dataset["id"],
            "schemaVersion": "cw-features-1",
            "provenance": "SYNTHETIC_DEMO",
            "trainingConfig": TrainingConfig(seed=43).model_dump(),
        }
        for m in results
    ]
    return dataset, models, directory


@pytest.mark.parametrize("target", ["CPU", "GPU"])
@pytest.mark.parametrize("algorithm", ["LINEAR", "RANDOM_FOREST", "XGBOOST"])
def test_all_model_types_additivity_baseline_and_log_space(fixture, target, algorithm):
    dataset, models, directory = fixture
    model = next(m for m in models if m["target"] == target and m["algorithm"] == algorithm)
    features = {k: dataset["rows"][0][k] for k in Features.model_fields}
    local = explain_local(model, dataset, features, directory, background_limit=128, repetitions=3)
    contributions = local["contributions"]
    total = local["baselineOutput"] + sum(c["value"] for c in contributions)
    assert abs(total - local["finalOutput"]) <= local["additivity"]["tolerance"]
    assert math.isclose(math.exp(local["finalOutput"]), local["predictedTimeMs"], rel_tol=2e-5)
    assert local["outputSpace"] == "LOG_TIME_MS" and local["contributionUnits"] == "ln(ms)"
    assert local["background"]["binding"] == "ARTIFACT_AND_REGISTRY"
    global_result = explain_global(model, dataset, directory, 16, 8)
    assert global_result["model"]["target"] == target
    assert global_result["evaluation"]["sampleSize"] == 8
    assert global_result["additivity"]["passed"]
    assert any(c["value"] > 0 for c in contributions)
    assert any(c["value"] < 0 for c in contributions)
    context = prepare_context(model, dataset, directory, 128)
    # SHAP defaults to subsampling maskers to 100; our explicit limit must prevail.
    assert len(context["explainer"].masker.data) == local["background"]["sampleSize"]
    indices = local["background"]["trainingRowIndices"]
    transformed = context["preprocessor"].transform(context["frame"].iloc[indices])
    reference = float(np.mean(context["regressor"].predict(transformed))) + math.log(3)
    assert abs(reference - local["baselineOutput"]) < 1e-5
    names = [m["transformed"] for m in local["transformedContributions"]]
    assert any("missingindicator" in name for name in names)
    assert len(names) > len(contributions)
    for c in contributions:
        mapped = [
            m["value"] for m in local["transformedContributions"] if m["feature"] == c["feature"]
        ]
        assert math.isclose(sum(mapped), c["value"], rel_tol=1e-10, abs_tol=1e-12)


def test_deterministic_training_only_background_and_held_out_global_sample(fixture):
    dataset, models, directory = fixture
    model = models[1]
    first = explain_global(model, dataset, directory, 16, 12)
    second = explain_global(model, dataset, directory, 16, 12)
    assert first == second
    train_indices, _, test_indices, _ = grouped_split(
        pd.DataFrame(dataset["rows"]), TrainingConfig(seed=43)
    )
    assert set(first["background"]["trainingRowIndices"]) <= set(train_indices)
    assert set(first["evaluation"]["rowIndices"]) <= set(test_indices)
    assert not set(first["background"]["trainingRowIndices"]) & set(
        first["evaluation"]["rowIndices"]
    )
    values = [v["meanAbsShap"] for v in first["importance"]]
    assert values == sorted(values, reverse=True) and any(v > 0 for v in values)
    assert first["evaluation"]["sampleSize"] == 12
    family = next(iter(first["evaluation"]["families"]))
    by_family = explain_global(model, dataset, directory, 16, 12, family)
    assert list(by_family["evaluation"]["families"]) == [family]


def test_artifact_version_dataset_and_prediction_mismatches_are_rejected(fixture):
    dataset, models, directory = fixture
    model = models[0]
    features = {k: dataset["rows"][0][k] for k in Features.model_fields}
    for altered, pattern in [
        (dict(model, sha256="bad"), "integrity"),
        (dict(model, version="wrong"), "version"),
        (dict(model, schemaVersion="unknown"), "schema"),
        (dict(model, algorithm="RANDOM_FOREST"), "algorithm"),
    ]:
        with pytest.raises(ValueError, match=pattern):
            explain_local(altered, dataset, features, directory)
    changed = [dict(r) for r in dataset["rows"]]
    changed[0]["operation_count"] += 1
    with pytest.raises(ValueError, match="dataset or split"):
        explain_local(model, dict(dataset, rows=changed), features, directory)
    with pytest.raises(ValueError, match="saved prediction"):
        explain_local(model, dataset, features, directory, saved_time_ms=1e30)


def test_limits_and_internal_service_auth(fixture, monkeypatch):
    dataset, models, directory = fixture
    with pytest.raises(ValueError, match="Background"):
        explain_global(models[0], dataset, directory, 129, 12)
    with pytest.raises(ValueError, match="Evaluation"):
        explain_global(models[0], dataset, directory, 16, 129)
    with pytest.raises(ValueError, match="two held-out"):
        explain_global(models[0], dataset, directory, 16, 12, "unknown family")
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "private-test-token-" * 3)
    client = TestClient(app)
    assert client.post("/internal/explanations", json={}).status_code in [401, 403]
    headers = {"Authorization": "Bearer " + "private-test-token-" * 3}
    assert client.post("/internal/explanations", headers=headers, json={}).status_code == 422


def test_legacy_registry_bound_artifact_remains_explainable(fixture, tmp_path):
    dataset, models, directory = fixture
    model = models[0]
    bundle = joblib.load(directory / f"{model['id']}.joblib")
    del bundle["trainingReference"]
    path = tmp_path / f"{model['id']}.joblib"
    joblib.dump(bundle, path)
    legacy = dict(model, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    result = explain_global(legacy, dataset, tmp_path, 16, 8)
    assert result["background"]["binding"] == "LEGACY_REGISTRY_SPLIT_RECONSTRUCTION"


def test_subprocess_timeout_is_bounded(monkeypatch):
    import corewise_ml.explanation_worker as worker

    ticks = iter([0, 1000])
    monkeypatch.setattr(worker.time, "monotonic", lambda: next(ticks))
    result = worker.bounded_compute("not-a-job", "not-a-user", 5)
    assert "timeout" in result["error"]


def test_changed_bytes_are_rejected_before_deserialization(fixture, tmp_path, monkeypatch):
    import corewise_ml.training as training

    _, models, _ = fixture
    path = tmp_path / "changed.joblib"
    path.write_bytes(b"changed after path verification")
    monkeypatch.setattr(training, "verified_artifact_path", lambda *_: path)

    def forbidden(*args, **kwargs):
        pytest.fail("Changed bytes must not reach Joblib deserialization")

    monkeypatch.setattr(training.joblib, "load", forbidden)
    with pytest.raises(ValueError, match="integrity changed"):
        training.load_artifact(models[0], tmp_path)
