"""Durable leased claims + killable subprocess limits for all SHAP calculations."""

import logging
import multiprocessing as mp
import os
import queue
import time

from psycopg.types.json import Jsonb

from .database import connect

logger = logging.getLogger(__name__)


def claim(job_id=None):
    with connect() as conn:
        conn.execute(
            """UPDATE "ModelExplanation" SET status='FAILED',
          error='SHAP worker lease expired; explicitly retry this request',"completedAt"=now()
          WHERE status='RUNNING' AND "leaseUntil"<now()
          AND (%s::text IS NULL OR id=%s)""",
            (job_id, job_id),
        )
        job = conn.execute(
            """SELECT * FROM "ModelExplanation" WHERE status='QUEUED'
          AND (%s::text IS NULL OR id=%s) ORDER BY "createdAt"
          FOR UPDATE SKIP LOCKED LIMIT 1""",
            (job_id, job_id),
        ).fetchone()
        if job:
            conn.execute(
                """UPDATE "ModelExplanation" SET status='RUNNING',"startedAt"=now(),
              "leaseUntil"=now()+interval '5 minutes' WHERE id=%s""",
                (job["id"],),
            )
        return job


def child(job_id, user_id, output):
    try:
        from .explanation_jobs import compute_job

        output.put({"result": compute_job(job_id, user_id)})
    except Exception as exc:
        output.put({"error": f"{type(exc).__name__}: {str(exc)[:1800]}"})


def bounded_compute(job_id, user_id, timeout_seconds):
    context = mp.get_context("spawn")
    output = context.Queue(maxsize=1)
    process = context.Process(target=child, args=(job_id, user_id, output))
    process.start()
    deadline = time.monotonic() + timeout_seconds
    try:
        while time.monotonic() < deadline:
            try:
                return output.get(timeout=0.2)
            except queue.Empty:
                if not process.is_alive():
                    return {"error": "SHAP subprocess exited without an explanation"}
        return {"error": "SHAP execution timeout; subprocess terminated"}
    finally:
        if process.is_alive():
            process.terminate()
        process.join(timeout=5)
        if process.is_alive():
            process.kill()
            process.join(timeout=5)
        output.close()


def run_once(job_id=None):
    job = claim(job_id)
    if not job:
        return False
    try:
        timeout = min(120, max(5, int(os.environ.get("ML_EXPLANATION_TIMEOUT_SECONDS", "60"))))
        outcome = bounded_compute(job["id"], job["userId"], timeout)
        with connect() as conn:
            conn.execute(
                """UPDATE "ModelExplanation" SET status=%s,result=%s,error=%s,
              "completedAt"=now(),"leaseUntil"=NULL WHERE id=%s AND "userId"=%s
              AND status='RUNNING' """,
                (
                    "FAILED" if outcome.get("error") else "COMPLETED",
                    Jsonb(outcome["result"]) if "result" in outcome else None,
                    outcome.get("error"),
                    job["id"],
                    job["userId"],
                ),
            )
    except Exception:
        # If PostgreSQL is unavailable the durable lease will fail on a later scan.
        logger.exception("SHAP job persistence failed")
        try:
            with connect() as conn:
                conn.execute(
                    """UPDATE "ModelExplanation" SET status='FAILED',
                  error='SHAP worker could not start or persist the calculation; explicitly retry',
                  "completedAt"=now(),"leaseUntil"=NULL WHERE id=%s AND status='RUNNING' """,
                    (job["id"],),
                )
        except Exception:
            logger.exception("Could not record SHAP failure; durable lease remains recoverable")
    return True
