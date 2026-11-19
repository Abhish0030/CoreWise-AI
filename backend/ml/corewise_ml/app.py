import csv
import hmac
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from agent.provider import configuration
from agent.runtime import AgentRequest
from agent.runtime import events as agent_events
from agent.runtime import status as agent_status

from .database import connect
from .datasets import ingest
from .explanation_jobs import ExplanationRequest, queue_explanation
from .knowledge import EmbeddingRequest
from .knowledge import embed as embed_knowledge
from .schema import DatasetRequest, PredictionRequest
from .shared import model_reference, validate_shared
from .training import predict_artifact


@asynccontextmanager
async def lifespan(_app):
    configuration()  # Validate explicit configuration without making an external request.
    yield


app = FastAPI(
    title="CoreWise private ML", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan
)
bearer = HTTPBearer()


def authenticate(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    secret = os.environ.get("ML_INTERNAL_TOKEN", "")
    if len(secret) < 32 or secret.startswith("replace-with-"):
        raise HTTPException(503, "Internal ML credentials are not configured")
    if not hmac.compare_digest(credentials.credentials, secret):
        raise HTTPException(401, "Invalid internal service credentials")


@app.exception_handler(ValueError)
def invalid_input(_request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"error": str(exc)})


@app.exception_handler(csv.Error)
def invalid_csv(_request: Request, _exc: csv.Error):
    return JSONResponse(
        status_code=422, content={"error": "Malformed CSV quoting or record format"}
    )


@app.exception_handler(RequestValidationError)
def invalid_request(_request: Request, exc: RequestValidationError):
    issue = exc.errors()[0]
    return JSONResponse(
        status_code=422, content={"error": f"{'.'.join(map(str, issue['loc']))}: {issue['msg']}"}
    )


@app.get("/health", dependencies=[Depends(authenticate)])
def health():
    return {"status": "ok", "service": "corewise-ml"}


@app.post("/internal/explanations", dependencies=[Depends(authenticate)], status_code=202)
def explanations(body: ExplanationRequest):
    record = queue_explanation(body)
    return {"id": record["id"]}


@app.post("/internal/agent/status", dependencies=[Depends(authenticate)])
def agent_connection():
    return agent_status()


@app.post("/internal/agent/stream", dependencies=[Depends(authenticate)])
async def agent_stream(body: AgentRequest):
    async def stream():
        async for event in agent_events(body):
            yield "data: " + json.dumps(event, allow_nan=False) + "\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/internal/datasets", dependencies=[Depends(authenticate)])
def datasets(body: DatasetRequest):
    return ingest(body)


@app.post("/internal/predict", dependencies=[Depends(authenticate)])
def predict(body: PredictionRequest):
    features = body.features.model_dump()
    root = Path(os.environ.get("ML_ARTIFACT_ROOT", "backend/ml/artifacts")).resolve()
    models, times, warnings = {}, {}, []
    with connect() as conn:
        for target, supplied_id in [("CPU", body.cpuModelId), ("GPU", body.gpuModelId)]:
            model = conn.execute(
                """SELECT * FROM "MLModel" WHERE "userId"=%s AND target=%s
                AND active=true AND status='READY' AND (%s::text IS NULL OR id=%s)
                ORDER BY "createdAt" DESC LIMIT 1""",
                (body.userId, target, supplied_id, supplied_id),
            ).fetchone()
            publication = None
            if not model and supplied_id:
                candidate = conn.execute(
                    'SELECT * FROM "MLModel" WHERE id=%s AND target=%s AND "userId"<>%s',
                    (supplied_id, target, body.userId),
                ).fetchone()
                if candidate:
                    publication = conn.execute(
                        'SELECT * FROM "SharedModelPublication" WHERE "modelId"=%s',
                        (supplied_id,),
                    ).fetchone()
                    if publication:
                        hardware = conn.execute(
                            'SELECT * FROM "HardwareProfile" WHERE id=%s AND "userId"=%s',
                            (body.hardwareProfileId, body.userId),
                        ).fetchone()
                        validate_shared(candidate, publication, hardware, features)
                        model = candidate
            if not model:
                raise HTTPException(
                    409, f"No compatible active {target} model. Train and activate one."
                )
            value, notices = predict_artifact(model, features, root)
            if publication and notices:
                raise HTTPException(422, "Shared input exceeds the fitted artifact training ranges")
            times[target] = value
            warnings.extend(notices)
            models[target] = model_reference(model, publication)
            if publication:
                warnings.append(publication["limitations"])
                # Recheck after inference so a revocation during loading cannot escape.
                latest = conn.execute(
                    'SELECT * FROM "SharedModelPublication" WHERE "modelId"=%s',
                    (model["id"],),
                ).fetchone()
                validate_shared(model, latest, hardware, features)

    synthetic = any(m["datasetProvenance"] == "SYNTHETIC_DEMO" for m in models.values())
    return {
        "cpuTimeMs": times["CPU"],
        "gpuTimeMs": times["GPU"],
        "speedup": times["CPU"] / times["GPU"],
        "models": models,
        "provenance": "PREDICTED",
        "readiness": "READY",
        "warnings": sorted(set(warnings)),
        "label": "Demonstration dataset — not measured hardware performance."
        if synthetic
        else "Predictions from uploader-attested measurements; accuracy is not guaranteed.",
    }


@app.post("/internal/knowledge/embed", dependencies=[Depends(authenticate)])
def knowledge_embed(body: "EmbeddingRequest"):
    try:
        return embed_knowledge(body)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    except Exception:
        raise HTTPException(
            503, "Embedding service unavailable or busy; verify the pinned model cache"
        ) from None
