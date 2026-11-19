"""Database-authorized shared inference; never accept a client publication flag."""

import math

from fastapi import HTTPException


def validate_shared(model, publication, hardware, features):
    if (
        not publication
        or publication["revokedAt"] is not None
        or publication["approvedArtifactSha256"] != model["sha256"]
        or model["status"] != "READY"
    ):
        raise HTTPException(409, "Shared model is unavailable or revoked")
    policy = publication["hardwareCompatibility"]
    if (
        not hardware
        or hardware["cpuName"] != policy.get("cpuModel")
        or hardware["gpuName"] != policy.get("gpuModel")
    ):
        raise HTTPException(422, "Shared model requires the exact approved CPU and GPU identities")
    if features["workload_type"] not in policy.get("workloads", []) or features[
        "precision"
    ] not in policy.get("precisions", []):
        raise HTTPException(422, "Workload or precision is not approved for shared inference")
    ranges = model["featureSchema"].get("ranges", {})
    approved = policy.get("ranges", {})
    if not ranges or set(ranges) != set(approved):
        raise HTTPException(422, "Shared numerical compatibility policy is incomplete")
    for field, bounds in ranges.items():
        limits = approved[field]
        value = features.get(field)
        if (
            not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not bounds[0] <= limits[0] <= value <= limits[1] <= bounds[1]
        ):
            raise HTTPException(
                422, f"Shared inference requires {field} inside approved training ranges"
            )


def model_reference(model, publication=None):
    result = {
        "id": model["id"],
        "version": model["version"],
        "algorithm": model["algorithm"],
        "schemaVersion": model["schemaVersion"],
        "datasetProvenance": model["provenance"],
        "access": "SHARED_EXPERIMENTAL" if publication else "PRIVATE",
    }
    if publication:
        result["limitations"] = publication["limitations"]
    else:
        result.update(datasetId=model["datasetId"], artifactSha256=model["sha256"])
    return result
