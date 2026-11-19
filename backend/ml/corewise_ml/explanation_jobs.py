"""Owner-scoped durable SHAP queue shared by the private API and dedicated worker."""

import hashlib
import json
import os
from pathlib import Path
from uuid import uuid4

import shap
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .database import connect
from .explanations import POLICY_VERSION
from .training import data_digest, verified_artifact_path


class ExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: str = Field(min_length=1, max_length=100)
    kind: str = Field(pattern="^(LOCAL|GLOBAL)$")
    predictionId: str | None = Field(default=None, max_length=100)
    modelId: str | None = Field(default=None, max_length=100)
    backgroundLimit: int = Field(default=32, ge=8, le=128)
    sampleLimit: int = Field(default=32, ge=2, le=128)
    workloadFamily: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def identity(self):
        if self.kind == "LOCAL" and (not self.predictionId or self.modelId or self.workloadFamily):
            raise ValueError("Local explanation requires only an owned saved prediction")
        if self.kind == "GLOBAL" and (not self.modelId or self.predictionId):
            raise ValueError("Global explanation requires only an owned model")
        return self


def owned_sources(body: ExplanationRequest):
    with connect() as conn:
        prediction = None
        if body.kind == "LOCAL":
            prediction = conn.execute(
                """SELECT * FROM "MLPrediction" WHERE id=%s
                                         AND "userId"=%s""",
                (body.predictionId, body.userId),
            ).fetchone()
            if not prediction:
                raise ValueError("Owned prediction not found")
            refs = prediction["result"]["models"]
            identities = [(target, refs[target]["id"]) for target in ["CPU", "GPU"]]
        else:
            identities = [(None, body.modelId)]
        sources = []
        for target, model_id in identities:
            model = conn.execute(
                """SELECT * FROM "MLModel" WHERE id=%s AND "userId"=%s""", (model_id, body.userId)
            ).fetchone()
            if not model or model["status"] != "READY":
                raise ValueError("Owned fitted model unavailable")
            dataset = conn.execute(
                """SELECT * FROM "Dataset" WHERE id=%s AND "userId"=%s""",
                (model["datasetId"], body.userId),
            ).fetchone()
            if not dataset:
                raise ValueError("Owned training dataset unavailable")
            verified_artifact_path(
                model, Path(os.environ.get("ML_ARTIFACT_ROOT", "backend/ml/artifacts"))
            )
            if prediction:
                ref = prediction["result"]["models"][target]
                if (
                    model["target"] != target
                    or model["version"] != ref["version"]
                    or model["datasetId"] != ref["datasetId"]
                    or model["provenance"] != ref["datasetProvenance"]
                    or model["schemaVersion"] != ref["schemaVersion"]
                    or ref.get("artifactSha256", model["sha256"]) != model["sha256"]
                ):
                    raise ValueError("Saved prediction model/version/provenance no longer matches")
            sources.append((model, dataset))
    fingerprint = {
        "request": body.model_dump(),
        "policy": POLICY_VERSION,
        "shapVersion": shap.__version__,
        "sources": [
            {
                "modelId": m["id"],
                "version": m["version"],
                "sha256": m["sha256"],
                "schemaVersion": m["schemaVersion"],
                "datasetId": d["id"],
                "datasetVersion": d["version"],
                "datasetSha256": data_digest(d["rows"]),
                "trainingConfig": m["trainingConfig"],
            }
            for m, d in sources
        ],
        "prediction": {
            "features": prediction["features"],
            "result": prediction["result"],
            "workload": prediction["workloadSnapshot"],
        }
        if prediction
        else None,
    }
    key = hashlib.sha256(
        json.dumps(fingerprint, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return sources, prediction, key


def queue_explanation(body: ExplanationRequest):
    _, _, key = owned_sources(body)
    with connect() as conn:
        # Serialize owner submissions so the bounded queue limit cannot race.
        conn.execute('SELECT id FROM "User" WHERE id=%s FOR UPDATE', (body.userId,))
        existing = conn.execute(
            """SELECT * FROM "ModelExplanation" WHERE "userId"=%s
                                    AND "cacheKey"=%s FOR UPDATE""",
            (body.userId, key),
        ).fetchone()
        if existing and existing["status"] != "FAILED":
            return existing
        pending = conn.execute(
            """SELECT count(*) AS n FROM "ModelExplanation"
            WHERE "userId"=%s AND status IN ('QUEUED','RUNNING')""",
            (body.userId,),
        ).fetchone()["n"]
        if pending >= 4:
            raise ValueError("At most four pending SHAP jobs per owner; wait for completion")
        if existing:
            return conn.execute(
                """UPDATE "ModelExplanation" SET status='QUEUED', error=NULL,
              "startedAt"=NULL,"completedAt"=NULL,"leaseUntil"=NULL,result=NULL,
              attempts=attempts+1 WHERE id=%s RETURNING *""",
                (existing["id"],),
            ).fetchone()
        return conn.execute(
            """INSERT INTO "ModelExplanation"
          (id,"userId",kind,"predictionId","modelId","cacheKey",options,status,attempts,"createdAt")
          VALUES (%s,%s,%s,%s,%s,%s,%s,'QUEUED',1,now()) RETURNING *""",
            (
                str(uuid4()),
                body.userId,
                body.kind,
                body.predictionId,
                body.modelId,
                key,
                Jsonb(body.model_dump(exclude={"userId"})),
            ),
        ).fetchone()


def compute_job(job_id, user_id):
    from pathlib import Path

    from .explanations import explain_global, explain_local, serializable

    with connect() as conn:
        job = conn.execute(
            """SELECT * FROM "ModelExplanation" WHERE id=%s AND "userId"=%s""", (job_id, user_id)
        ).fetchone()
    if not job:
        raise ValueError("Owned explanation job not found")
    body = ExplanationRequest(userId=user_id, **job["options"])
    sources, prediction, key = owned_sources(body)
    if key != job["cacheKey"]:
        raise ValueError("Explanation sources changed after queueing; request a new explanation")
    root = Path(os.environ.get("ML_ARTIFACT_ROOT", "backend/ml/artifacts")).resolve()
    if prediction:
        repetitions = prediction["workloadSnapshot"]["repetitions"]
        explained = {}
        for model, dataset in sources:
            target = model["target"]
            explained[target] = explain_local(
                model,
                dataset,
                prediction["features"],
                root,
                background_limit=body.backgroundLimit,
                repetitions=repetitions,
                saved_time_ms=prediction["result"][f"{target.lower()}TimeMs"],
            )
            explained[target]["predictionArtifactBinding"] = (
                "SNAPSHOTTED_HASH"
                if (prediction["result"]["models"][target].get("artifactSha256"))
                else ("LEGACY_REGISTRY_VERSION")
            )
        return serializable(
            {
                "kind": "LOCAL",
                "provenance": "SHAP_MODEL_ATTRIBUTION",
                "predictionProvenance": "PREDICTED",
                "models": explained,
            }
        )
    model, dataset = sources[0]
    return serializable(
        {
            "kind": "GLOBAL",
            "provenance": "SHAP_MODEL_ATTRIBUTION",
            "global": explain_global(
                model, dataset, root, body.backgroundLimit, body.sampleLimit, body.workloadFamily
            ),
        }
    )
