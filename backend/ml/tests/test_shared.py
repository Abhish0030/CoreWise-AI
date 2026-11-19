"""Controlled inference fixtures only; no training or real model publication."""

from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from corewise_ml.app import app
from corewise_ml.datasets import generate
from corewise_ml.schema import Features


@pytest.fixture
def setup(monkeypatch):
    import corewise_ml.app as module

    features = {k: generate(120, 42)[0][k] for k in Features.model_fields}
    ranges = {k: [v, v] for k, v in features.items() if isinstance(v, (int, float))}
    state = {
        "owner": False,
        "publication": True,
        "revoked": False,
        "hardware": True,
        "hash": True,
        "revoke_during": False,
        "calls": 0,
    }
    models = {
        target: {
            "id": target,
            "version": target,
            "target": target,
            "status": "READY",
            "sha256": "a" * 64,
            "algorithm": "LINEAR",
            "schemaVersion": "cw-features-1",
            "datasetId": "private-dataset",
            "provenance": "SYNTHETIC_DEMO",
            "featureSchema": {"ranges": ranges},
        }
        for target in ["CPU", "GPU"]
    }
    publication = {
        "revokedAt": None,
        "approvedArtifactSha256": "a" * 64,
        "limitations": "Experimental test fixture only",
        "hardwareCompatibility": {
            "cpuModel": "Fixture CPU",
            "gpuModel": "Fixture GPU",
            "workloads": [features["workload_type"]],
            "precisions": [features["precision"]],
            "ranges": ranges,
        },
    }

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def execute(self, sql, args):
            value = None
            if 'FROM "MLModel"' in sql:
                if "active=true" in sql:
                    value = models[args[1]] if state["owner"] else None
                else:
                    value = models[args[1]]
            elif 'FROM "SharedModelPublication"' in sql and state["publication"]:
                value = deepcopy(publication)
                value["revokedAt"] = "revoked" if state["revoked"] else None
                if not state["hash"]:
                    value["approvedArtifactSha256"] = "b" * 64
            elif 'FROM "HardwareProfile"' in sql and state["hardware"]:
                value = {"cpuName": "Fixture CPU", "gpuName": "Fixture GPU"}
            return SimpleNamespace(fetchone=lambda: value)

    def controlled_prediction(*args):
        state["calls"] += 1
        if state["revoke_during"]:
            state["revoked"] = True
        return 1.0, []  # Explicit mock; never presented as model accuracy evidence.

    monkeypatch.setattr(module, "connect", Connection)
    monkeypatch.setattr(module, "predict_artifact", controlled_prediction)
    token = "isolated-test-service-token-2026-long"
    monkeypatch.setenv("ML_INTERNAL_TOKEN", token)
    return (
        TestClient(app),
        state,
        {
            "userId": "fixture-reader",
            "hardwareProfileId": "owned-profile",
            "features": features,
            "cpuModelId": "CPU",
            "gpuModelId": "GPU",
        },
        {"Authorization": "Bearer " + token},
    )


def test_shared_privacy_and_private_behavior(setup):
    client, state, body, headers = setup
    response = client.post("/internal/predict", json=body, headers=headers)
    assert response.status_code == 200
    assert response.json()["provenance"] == "PREDICTED"
    assert "private-dataset" not in response.text and "artifactSha256" not in response.text
    assert response.json()["models"]["CPU"]["access"] == "SHARED_EXPERIMENTAL"
    state["owner"] = True
    response = client.post("/internal/predict", json=body, headers=headers)
    assert response.status_code == 200
    assert response.json()["models"]["CPU"]["datasetId"] == "private-dataset"


@pytest.mark.parametrize(
    "failure",
    ["unpublished", "revoked", "hardware", "hash", "range", "category", "precision", "during"],
)
def test_shared_rejects_invalid_authorization_and_compatibility(setup, failure):
    client, state, body, headers = setup
    if failure == "unpublished":
        state["publication"] = False
    elif failure == "revoked":
        state["revoked"] = True
    elif failure in ["hardware", "hash"]:
        state[failure] = False
    elif failure == "range":
        body["features"]["cpu_cores"] += 1
    elif failure == "category":
        body["features"]["workload_type"] = "UNSUPPORTED"
    elif failure == "precision":
        body["features"]["precision"] = (
            "FP64" if body["features"]["precision"] != "FP64" else "FP32"
        )
    else:
        state["revoke_during"] = True
    response = client.post("/internal/predict", json=body, headers=headers)
    assert response.status_code in [409, 422]
    if failure != "during":
        assert state["calls"] == 0


def test_service_auth_and_client_flag_rejected(setup):
    client, _, body, headers = setup
    assert client.post("/internal/predict", json=body).status_code in [401, 403]
    assert (
        client.post("/internal/predict", json={**body, "shared": True}, headers=headers).status_code
        == 422
    )
