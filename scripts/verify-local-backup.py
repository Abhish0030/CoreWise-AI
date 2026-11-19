"""Local-only backup and isolated restore verification; never logs connection secrets."""

import hashlib
import json
import os
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from dotenv import load_dotenv
from psycopg import sql


def main():
    load_dotenv()
    url = urlsplit(os.environ["DATABASE_URL"])
    if url.hostname not in {"localhost", "127.0.0.1"}:
        raise SystemExit("Backup verification is restricted to the local database.")
    dsn = urlunsplit(
        url._replace(
            query=urlencode(
                [
                    (k, v)
                    for k, v in parse_qsl(url.query)
                    if k
                    not in {"schema", "connection_limit", "pool_timeout", "pgbouncer"}
                ]
            )
        )
    )
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    root = Path(".artifacts/backups") / stamp
    root.mkdir(parents=True, exist_ok=False)
    container = "corewise-ai-postgres-1"
    remote = "/tmp/corewise_" + stamp + ".dump"
    temporary = "corewise_restore_" + stamp
    role = url.username
    source = url.path.strip("/")

    def run(args):
        result = subprocess.run(args, capture_output=True, check=False)
        if result.returncode:
            raise SystemExit(
                "Database backup/restore command failed; connection details withheld."
            )
        return result.stdout

    def inventory(database=None):
        with psycopg.connect(dsn, **({"dbname": database} if database else {})) as conn:
            tables = conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            ).fetchall()
            result = {}
            for (table,) in tables:
                query = sql.SQL(
                    "SELECT count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),'')) FROM public.{} t"
                ).format(sql.Identifier(table))
                count, digest = conn.execute(query).fetchone()
                result[table] = {"rows": count, "digest": digest}
            return result

    before = inventory()
    run(
        [
            "docker",
            "exec",
            container,
            "pg_dump",
            "-U",
            role,
            "-d",
            source,
            "-Fc",
            "-f",
            remote,
        ]
    )
    run(["docker", "cp", container + ":" + remote, str(root / "database.dump")])
    listing = run(["docker", "exec", container, "pg_restore", "--list", remote])
    if len(listing) < 100:
        raise SystemExit("Backup archive listing failed validation")
    run(["docker", "exec", container, "createdb", "-U", role, temporary])
    run(
        [
            "docker",
            "exec",
            container,
            "pg_restore",
            "-U",
            role,
            "-d",
            temporary,
            "--no-owner",
            "--no-acl",
            "--exit-on-error",
            remote,
        ]
    )
    after = inventory(temporary)
    if before != after:
        raise SystemExit("Restore verification differs; no migrations may run.")
    artifacts = []
    artifact_directory = Path(
        os.getenv("ML_ARTIFACT_ROOT", "backend/ml/artifacts")
    ).resolve()
    (root / "model-artifacts").mkdir()
    with psycopg.connect(dsn) as conn:
        for model_id, expected in conn.execute('SELECT id,sha256 FROM "MLModel"'):
            source = artifact_directory / f"{model_id}.joblib"
            if (
                not source.is_file()
                or hashlib.sha256(source.read_bytes()).hexdigest() != expected
            ):
                raise SystemExit(
                    "Registered model artifact is missing or has an invalid digest"
                )
            shutil.copy2(source, root / "model-artifacts" / source.name)
            artifacts.append({"id": model_id, "sha256": expected})
    report = {
        "verifiedAt": datetime.now(UTC).isoformat(),
        "restoreDatabase": temporary,
        "sourceTables": before,
        "restoredTables": after,
        "archiveSha256": hashlib.sha256(
            (root / "database.dump").read_bytes()
        ).hexdigest(),
        "verified": True,
        "modelArtifacts": artifacts,
    }
    (root / "verification.json").write_text(json.dumps(report, indent=2))
    print(
        json.dumps(
            {
                "verified": True,
                "backupDirectory": str(root),
                "restoredDatabase": temporary,
                "tableCounts": {k: v["rows"] for k, v in before.items()},
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 - sanitize every upstream database error
        raise SystemExit(
            "Local backup/restore failed; private connection details withheld"
        ) from None
