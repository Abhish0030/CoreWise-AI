"""Durable PostgreSQL queue. Run separately from FastAPI; restart-safe leased claims."""

import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from psycopg.types.json import Jsonb

from .database import connect
from .schema import SCHEMA_VERSION, TrainingConfig
from .training import train

ARTIFACT_ROOT = Path(os.environ.get("ML_ARTIFACT_ROOT", "backend/ml/artifacts")).resolve()
logger = logging.getLogger(__name__)


def claim(job_id=None):
    with connect() as conn:
        # Interrupted jobs become explicitly FAILED after their lease; never silently completed.
        conn.execute(
            """UPDATE "TrainingJob" SET status='FAILED',
                        error='Worker lease expired; submit a new training job',
                        "completedAt"=now() WHERE status='RUNNING' AND "leaseUntil" < now()
                        AND (%s::text IS NULL OR id=%s)""",
            (job_id, job_id),
        )
        job = conn.execute(
            """SELECT * FROM "TrainingJob" WHERE status='QUEUED'
                            AND (%s::text IS NULL OR id=%s)
                            ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1""",
            (job_id, job_id),
        ).fetchone()
        if job:
            conn.execute(
                """UPDATE "TrainingJob" SET status='RUNNING', "startedAt"=now(),
                            "leaseUntil"=now()+interval '5 minutes' WHERE id=%s""",
                (job["id"],),
            )
        return job


def run_once(job_id=None):
    job = claim(job_id)
    if not job:
        return False
    logs = []
    stop = threading.Event()
    artifacts = []

    def log(message):
        logs.append(f"{datetime.now(timezone.utc).isoformat()} {message}")
        with connect() as conn:
            conn.execute(
                """UPDATE "TrainingJob" SET logs=%s WHERE id=%s AND status='RUNNING' """,
                (Jsonb(logs), job["id"]),
            )

    def heartbeat():
        while not stop.wait(20):
            try:
                with connect() as conn:
                    conn.execute(
                        """UPDATE "TrainingJob" SET "leaseUntil"=now()+interval '5 minutes'
                                    WHERE id=%s AND status='RUNNING' """,
                        (job["id"],),
                    )
            except Exception:
                logger.exception("Worker heartbeat failed")

    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        with connect() as conn:
            dataset = conn.execute(
                """SELECT * FROM "Dataset" WHERE id=%s AND "userId"=%s""",
                (job["datasetId"], job["userId"]),
            ).fetchone()
        if not dataset:
            raise ValueError("Owned dataset no longer exists")
        artifacts = train(
            dataset["rows"],
            TrainingConfig.model_validate(job["config"]),
            ARTIFACT_ROOT,
            log,
            created=artifacts,
        )
        logs.append("Fitting complete; committing registry atomically with inactive models")
        with connect() as conn:
            live = conn.execute(
                """SELECT status FROM "TrainingJob" WHERE id=%s
                                  FOR UPDATE""",
                (job["id"],),
            ).fetchone()
            if not live or live["status"] != "RUNNING":
                raise ValueError("Job lease lost; artifacts will not be registered")
            for model in artifacts:
                conn.execute(
                    """INSERT INTO "MLModel"
                    (id,"userId","datasetId","trainingJobId",name,algorithm,target,version,
                     "schemaVersion",provenance,status,active,selected,sha256,"artifactLocation",
                     "featureSchema",evaluation,"trainingConfig","createdAt")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'READY',false,%s,%s,%s,%s,%s,%s,now())""",
                    (
                        model["id"],
                        job["userId"],
                        dataset["id"],
                        job["id"],
                        f"{model['target']} {model['algorithm']}",
                        model["algorithm"],
                        model["target"],
                        model["id"],
                        SCHEMA_VERSION,
                        dataset["provenance"],
                        model["selected"],
                        model["sha256"],
                        f"{model['id']}.joblib",
                        Jsonb(model["featureSchema"]),
                        Jsonb(model["evaluation"]),
                        Jsonb(job["config"]),
                    ),
                )
            conn.execute(
                """UPDATE "TrainingJob" SET status='COMPLETED', "completedAt"=now(),
                            "leaseUntil"=NULL, logs=%s WHERE id=%s""",
                (Jsonb(logs), job["id"]),
            )
    except Exception as exc:
        logger.exception("Training job failed: %s", job["id"])
        for model in artifacts:
            (ARTIFACT_ROOT / f"{model['id']}.joblib").unlink(missing_ok=True)
        with connect() as conn:
            conn.execute(
                """UPDATE "TrainingJob" SET status='FAILED', error=%s, logs=%s,
                            "completedAt"=now(), "leaseUntil"=NULL WHERE id=%s
                            AND status='RUNNING' """,
                (str(exc)[:2000], Jsonb(logs), job["id"]),
            )
    finally:
        stop.set()
        thread.join(timeout=5)
    return True


def main():
    from .explanation_worker import run_once as explain_once

    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            worked = run_once()
            worked = explain_once() or worked
        except Exception:
            logger.exception("Worker queue unavailable; retrying without discarding durable jobs")
            worked = False
        if not worked:
            time.sleep(2)


if __name__ == "__main__":
    main()
