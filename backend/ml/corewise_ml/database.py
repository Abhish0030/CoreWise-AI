import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

if os.getenv("COREWISE_ENV_LOADED") != "1" and os.getenv("COREWISE_DB_ENV") != "neon-production":
    environment = os.getenv("COREWISE_DB_ENV", "local")
    if environment not in {"local", "neon-development"}:
        raise ValueError("Unknown database environment")
    load_dotenv(".env" if environment == "local" else ".env.neon.development.local")


def connect():
    try:
        url = urlsplit(os.environ["DATABASE_URL"])
        if (
            url.scheme not in {"postgres", "postgresql"}
            or not url.hostname
            or not url.username
            or not url.password
            or (url.port is not None and not 1 <= url.port <= 65535)
        ):
            raise ValueError
    except (KeyError, ValueError):
        raise ValueError("Database configuration is invalid; details withheld") from None
    environment = os.getenv("COREWISE_DB_ENV", "local")
    if environment == "local" and url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Local services cannot target a remote database")
    if environment not in {"local", "neon-development", "neon-production"}:
        raise ValueError("Unknown database environment")
    if environment != "local" and (
        not url.hostname.endswith(".neon.tech")
        or dict(parse_qsl(url.query)).get("sslmode") not in {"require", "verify-full"}
        or os.getenv("NEON_CREDENTIALS_ROTATED") != "true"
    ):
        raise ValueError("Neon requires TLS and newly rotated credentials")
    if environment != "local" and (
        not os.getenv("NEON_BRANCH_NAME")
        or (
            environment == "neon-development"
            and os.getenv("NEON_BRANCH_NAME", "").lower() in {"production", "main"}
        )
    ):
        raise ValueError("Identify the intended nonproduction branch explicitly")
    # Prisma's schema query parameter is not a libpq connection parameter.
    query = urlencode(
        [
            (k, v)
            for k, v in parse_qsl(url.query)
            if k not in {"schema", "connection_limit", "pool_timeout", "pgbouncer"}
        ]
    )
    return psycopg.connect(
        urlunsplit(url._replace(query=query)),
        row_factory=dict_row,
        connect_timeout=10,
        prepare_threshold=None,
    )
