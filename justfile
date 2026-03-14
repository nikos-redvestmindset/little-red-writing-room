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

# ── modal (remote pipeline) ───────────────────────────────────────────────────

# first-time Modal setup: install client, create secret, deploy the pipeline app
create-modal:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source srv/.env.cloud; set +a
    cd srv
    uv sync --extra modal
    echo "Creating Modal secret 'lrwr-env'..."
    uv run modal secret create lrwr-env \
        APP_SUPABASE_URL="$APP_SUPABASE_URL" \
        APP_SUPABASE_SERVICE_KEY="$APP_SUPABASE_SERVICE_KEY" \
        APP_OPENAI_API_KEY="$APP_OPENAI_API_KEY" \
        OPENAI_API_KEY="$APP_OPENAI_API_KEY" \
        PIPELINE_COLLECTION_NAME="$PIPELINE_COLLECTION_NAME" \
        PIPELINE_EMBEDDING_MODEL="$PIPELINE_EMBEDDING_MODEL" \
        PIPELINE_CLASSIFICATION_MODEL="$PIPELINE_CLASSIFICATION_MODEL" \
        PIPELINE_QDRANT_URL="$PIPELINE_QDRANT_URL" \
        PIPELINE_QDRANT_API_KEY="$PIPELINE_QDRANT_API_KEY"
    echo "Deploying Modal app 'lrwr-pipeline'..."
    uv run modal deploy pipeline/modal_app.py
    echo "Done. The pipeline is now available on Modal."

# redeploy the Modal pipeline app (after code changes)
deploy-modal:
    cd srv && uv run --env-file .env.cloud modal deploy pipeline/modal_app.py

# smoke-test the deployed Modal pipeline with a sample document
test-modal:
    cd srv && uv run --extra modal --env-file .env.cloud python -m scripts.test_modal

# ── database ──────────────────────────────────────────────────────────────────

# apply pending Supabase migrations
migrate:
    cd srv && uv run python -m scripts.migrate

# wipe all RAG state: Qdrant collection + Supabase extraction tables (DESTRUCTIVE)
reset-rag:
    cd srv && uv run --env-file .env.cloud python -m scripts.reset_rag

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
