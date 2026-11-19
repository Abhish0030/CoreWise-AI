"""Inspect Neon read-only; restore only a verified archive into an empty verified branch."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

import psycopg
from dotenv import dotenv_values
from psycopg import sql

parser = argparse.ArgumentParser()
parser.add_argument(
    "--environment", choices=["neon-development", "neon-production"], required=True
)
parser.add_argument("operation", choices=["inspect", "restore"])
parser.add_argument("--backup")
parser.add_argument("--approved-production-cutover", action="store_true")
a = parser.parse_args()


class TransferError(ValueError):
    """Only application-authored messages may be shown to the operator."""


def main():
    environment_file = ".env." + a.environment.replace("-", ".") + ".local"
    config = dotenv_values(environment_file)
    if config.get("NEON_CREDENTIALS_ROTATED") != "true":
        raise TransferError("Attest newly rotated credentials before contacting Neon.")
    pooled = urlsplit(config.get("DATABASE_URL") or "")
    direct = urlsplit(config.get("DIRECT_URL") or "")
    if (
        direct.scheme not in {"postgres", "postgresql"}
        or pooled.scheme not in {"postgres", "postgresql"}
        or dict(parse_qsl(pooled.query)).get("sslmode")
        not in {"require", "verify-full"}
        or not direct.hostname
        or not direct.hostname.endswith(".neon.tech")
        or "-pooler." in direct.hostname
        or pooled.hostname != direct.hostname.replace(".", "-pooler.", 1)
        or pooled.path != direct.path
        or pooled.username != direct.username
        or not direct.password
        or dict(parse_qsl(direct.query)).get("sslmode")
        not in {"require", "verify-full"}
    ):
        raise TransferError("Matching pooled/direct Neon TLS endpoints are required.")
    branch = config.get("NEON_BRANCH_NAME")
    if not branch or (
        a.environment == "neon-development" and branch.lower() in {"production", "main"}
    ):
        raise TransferError("Identify the intended nonproduction branch explicitly.")
    params = [
        (k, v)
        for k, v in parse_qsl(direct.query)
        if k not in {"schema", "pgbouncer", "connection_limit", "pool_timeout"}
    ]
    dsn = urlunsplit(direct._replace(query=urlencode(params)))
    with psycopg.connect(
        dsn,
        connect_timeout=15,
        autocommit=True,
        options="-c default_transaction_read_only=on",
    ) as conn:
        version = int(conn.execute("SHOW server_version_num").fetchone()[0])
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            )
        ]
        extensions = conn.execute(
            "SELECT name,default_version,installed_version FROM pg_available_extensions WHERE name='vector'"
        ).fetchall()
        database_name, database_role = conn.execute(
            "SELECT current_database(), current_user"
        ).fetchone()
        branch_id = conn.execute(
            "SELECT current_setting('neon.branch_id',true)"
        ).fetchone()[0]
    verified = bool(branch_id and branch_id == config.get("NEON_BRANCH_ID"))
    if config.get("NEON_API_KEY") and config.get("NEON_PROJECT_ID"):
        project = config["NEON_PROJECT_ID"]
        endpoint = direct.hostname.split(".")[0]
        if not re.fullmatch("[a-zA-Z0-9-]+", project):
            raise TransferError("Invalid Neon project ID")

        def get(path):
            request = urllib.request.Request(
                "https://console.neon.tech/api/v2/" + path,
                headers={"Authorization": "Bearer " + config["NEON_API_KEY"]},
            )
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)

        endpoint_info = get(f"projects/{project}/endpoints/{endpoint}")["endpoint"]
        info = get(f"projects/{project}/branches/{endpoint_info['branch_id']}")[
            "branch"
        ]
        verified = info["name"] == branch and (
            a.environment != "neon-development"
            or info["name"].lower() not in {"production", "main"}
        )
        if config.get("NEON_BRANCH_ID") and info["id"] != config["NEON_BRANCH_ID"]:
            verified = False
    print(
        json.dumps(
            {
                "connected": True,
                "endpointHost": direct.hostname,
                "endpointPort": direct.port or 5432,
                "databaseName": database_name,
                "databaseRole": database_role,
                "environment": a.environment,
                "branchVerified": verified,
                "postgresVersionNumber": version,
                "publicTables": tables,
                "vectorAvailable": bool(extensions),
                "vectorInstalledVersion": extensions[0][2] if extensions else None,
            }
        )
    )
    if a.operation == "inspect":
        return
    if not verified:
        raise TransferError(
            "Independent branch verification is required before restore. Configure Neon API/project or a matching server-reported branch ID."
        )
    if a.environment == "neon-production" and not a.approved_production_cutover:
        raise TransferError("Explicit approved production cutover is required.")
    if tables or version < 170000 or not extensions:
        raise TransferError(
            "Restore requires an empty compatible destination with pgvector available; nothing was overwritten."
        )
    directory = Path(a.backup or "").resolve()
    if not directory.is_relative_to(Path(".artifacts/backups").resolve()):
        raise TransferError("Select a verified local backup directory.")
    report = json.loads((directory / "verification.json").read_text())
    archive = directory / "database.dump"
    if (
        not report.get("verified")
        or report["archiveSha256"] != hashlib.sha256(archive.read_bytes()).hexdigest()
    ):
        raise TransferError("Backup verification/hash mismatch")
    if "KnowledgeDocument" not in report["sourceTables"]:
        raise TransferError(
            "Create a fresh verified backup after the additive vector migration."
        )
    remote = "/tmp/corewise_neon_verified_restore.dump"
    copied = subprocess.run(
        ["docker", "cp", str(archive), "corewise-ai-postgres-1:" + remote],
        capture_output=True,
        check=False,
    )
    if copied.returncode:
        raise TransferError("Could not stage verified backup")
    environment = {
        **os.environ,
        "PGHOST": direct.hostname,
        "PGPORT": str(direct.port or 5432),
        "PGUSER": unquote(direct.username),
        "PGPASSWORD": unquote(direct.password),
        "PGDATABASE": unquote(direct.path.lstrip("/")),
        "PGSSLMODE": dict(params).get("sslmode", "require"),
    }
    command = ["docker", "exec"]
    for name in ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"]:
        command += ["--env", name]
    command += [
        "corewise-ai-postgres-1",
        "pg_restore",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--dbname",
        environment["PGDATABASE"],
        remote,
    ]
    result = subprocess.run(command, env=environment, capture_output=True, check=False)
    if result.returncode:
        raise TransferError(
            "Transactional restore failed; upstream connection/error details withheld."
        )
    with psycopg.connect(
        dsn, connect_timeout=15, options="-c default_transaction_read_only=on"
    ) as conn:
        for table, expected in report["sourceTables"].items():
            query = sql.SQL(
                "SELECT count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) FROM public.{} t"
            ).format(sql.Identifier(table))
            count, digest = conn.execute(query).fetchone()
            if count != expected["rows"] or digest != expected["digest"]:
                raise TransferError("Restored record digest verification failed")
    print(
        json.dumps(
            {
                "restored": True,
                "allTableDigestsMatch": True,
                "environment": a.environment,
                "modelArtifactFilesCopied": False,
            }
        )
    )


try:
    main()
except TransferError as error:
    print(json.dumps({"success": False, "message": str(error)}))
    raise SystemExit(1) from None
except Exception:  # noqa: BLE001 - never expose upstream connection details
    print(
        json.dumps(
            {
                "success": False,
                "message": "Neon operation failed; private connection details withheld.",
            }
        )
    )
    raise SystemExit(1) from None
