import pytest

from corewise_ml import database


@pytest.mark.parametrize(
    "url,environment",
    [
        ("https://user:must-not-print@ep-test.neon.tech/db?sslmode=require", "neon-development"),
        ("postgresql://user:must-not-print@ep-test.neon.tech/db?sslmode=require", "local"),
        (
            "postgresql://user:must-not-print@ep-test.neon.tech/db?sslmode=disable",
            "neon-development",
        ),
        (
            "postgresql://user:must-not-print@ep-test.neon.tech/db?sslmode=require",
            "neon-development",
        ),
    ],
)
def test_database_configuration_fails_closed(monkeypatch, url, environment):
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("COREWISE_DB_ENV", environment)
    monkeypatch.setenv("NEON_CREDENTIALS_ROTATED", "true")
    monkeypatch.setenv("NEON_BRANCH_NAME", "production")
    with pytest.raises(ValueError) as failure:
        database.connect()
    assert "must-not-print" not in str(failure.value)


def test_libpq_parameters_are_bounded_and_prisma_options_are_removed(monkeypatch):
    seen = {}

    def connect(url, **kwargs):
        seen.update(url=url, **kwargs)
        return "connection"

    monkeypatch.setattr(database.psycopg, "connect", connect)
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:fixture@127.0.0.1:55432/corewise?schema=public&connection_limit=5&pool_timeout=20&pgbouncer=true&sslmode=prefer",
    )
    monkeypatch.setenv("COREWISE_DB_ENV", "local")
    assert database.connect() == "connection"
    assert "schema=" not in seen["url"] and "connection_limit=" not in seen["url"]
    assert "pgbouncer=" not in seen["url"] and "sslmode=prefer" in seen["url"]
    assert seen["connect_timeout"] == 10 and seen["prepare_threshold"] is None
