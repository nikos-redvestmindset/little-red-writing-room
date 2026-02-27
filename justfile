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

# start the Next.js dev server
dev-web:
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

# start the FastAPI dev server (reload on file changes)
dev-srv:
    cd srv && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8008

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

# run both dev servers concurrently (requires a terminal multiplexer or parallel)
dev:
    just dev-srv & just dev-web

# run all tests
test: test-web test-srv
