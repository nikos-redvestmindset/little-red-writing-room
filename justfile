# little-red-writing-room — task runner
# requires: just (https://github.com/casey/just)

# show available recipes
default:
    @just --list

# ── setup ────────────────────────────────────────────────────────────────────

# install all dependencies (web + srv + notebooks)
setup: setup-web setup-srv setup-notebooks

# install Next.js dependencies
setup-web:
    cd web && pnpm install

# sync srv dependencies via uv
setup-srv:
    cd srv && uv sync --extra dev

# ── web (Next.js) ────────────────────────────────────────────────────────────

# start the Next.js dev server with local config (web/.env.local)
dev-web:
    cd web && pnpm dev --port 3003

# start the Next.js dev server with cloud config (web/.env.cloud)
web:
    #!/usr/bin/env bash
    set -a; source web/.env.cloud; set +a
    cd web && pnpm dev --port 3003

# build the Next.js production bundle
build-web:
    cd web && pnpm build

# run Next.js tests
test-web:
    cd web && pnpm test

# lint the Next.js app
lint-web:
    cd web && pnpm lint

# ── srv (FastAPI) ─────────────────────────────────────────────────────────────

# start the FastAPI dev server with local in-memory config (reload on file changes)
dev-api:
    cd srv && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8008

# start the FastAPI server with cloud config (Qdrant Cloud, Modal, APP_ENV=dev)
api:
    cd srv && uv run --env-file .env.cloud uvicorn app.main:app --reload --host 0.0.0.0 --port 8008

# run FastAPI tests
test-srv:
    cd srv && uv run pytest

# lint the FastAPI app
lint-srv:
    cd srv && uv run ruff check .

# ── database ──────────────────────────────────────────────────────────────────

# apply pending Supabase migrations
migrate:
    cd srv && uv run python -m scripts.migrate

# ── notebooks ────────────────────────────────────────────────────────────────

# sync notebooks venv and install dependencies
setup-notebooks:
    cd notebooks && uv sync --extra dev
    cd notebooks && uv run python -m ipykernel install --user --name lrwr-notebooks --display-name "LRWR Notebooks"

# launch Jupyter Lab for notebooks
run-notebook:
    cd notebooks && uv run jupyter lab

# ── combined ─────────────────────────────────────────────────────────────────


# run all tests
test: test-web test-srv
