"""
Run Supabase migrations from srv/migrations/*.sql in filename order.

Tracks applied migrations in a _migrations table so each file runs at most once.
Reads DATABASE_URL from srv/.env (or the environment).

Usage:
    uv run python -m scripts.migrate          # from srv/
    just migrate                               # from repo root
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

BOOTSTRAP_SQL = """\
CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    sha256     TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def _sha256(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def run_migrations() -> None:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    raw_dsn = os.environ.get("DATABASE_URL")
    if not raw_dsn:
        print("ERROR: DATABASE_URL is not set. Add it to srv/.env or export it.")
        sys.exit(1)

    # Parse the URI manually so passwords with %, //, etc. don't break urlparse.
    m = re.match(r"^postgresql://([^:]+):(.+)@([^@]+):(\d+)/(.+)$", raw_dsn)
    if not m:
        print("ERROR: DATABASE_URL must be in the format postgresql://user:pass@host:port/dbname")
        sys.exit(1)
    connect_kwargs = dict(
        user=m.group(1), password=m.group(2),
        host=m.group(3), port=int(m.group(4)), dbname=m.group(5),
    )

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        print("No migration files found in", MIGRATIONS_DIR)
        return

    with psycopg.connect(**connect_kwargs) as conn:
        conn.execute(BOOTSTRAP_SQL)
        conn.commit()

        applied: set[str] = {
            row[0] for row in conn.execute("SELECT name FROM _migrations").fetchall()
        }

        pending = [f for f in sql_files if f.name not in applied]

        if not pending:
            print("All migrations already applied.")
            return

        for f in pending:
            content = f.read_text()
            digest = _sha256(content)
            print(f"  Applying {f.name} …", end=" ", flush=True)
            conn.execute(content)
            conn.execute(
                "INSERT INTO _migrations (name, sha256) VALUES (%s, %s)",
                (f.name, digest),
            )
            conn.commit()
            print("OK")

        print(f"\n{len(pending)} migration(s) applied.")


if __name__ == "__main__":
    run_migrations()
