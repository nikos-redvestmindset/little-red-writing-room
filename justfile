# little-red-writing-room — task runner
# requires: just (https://github.com/casey/just)

# show available recipes
default:
    @just --list

# ── setup ────────────────────────────────────────────────────────────────────

# install all dependencies (web + srv)
setup: setup-web setup-srv

# install Next.js dependencies
setup-web:
    cd web && npm install

# create a Python virtual-env and install FastAPI dependencies
setup-srv:
    cd srv && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# ── web (Next.js) ────────────────────────────────────────────────────────────

# start the Next.js dev server
dev-web:
    cd web && npm run dev

# build the Next.js production bundle
build-web:
    cd web && npm run build

# run Next.js tests
test-web:
    cd web && npm test

# lint the Next.js app
lint-web:
    cd web && npm run lint

# ── srv (FastAPI) ─────────────────────────────────────────────────────────────

# start the FastAPI dev server (reload on file changes)
dev-srv:
    cd srv && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# run FastAPI tests
test-srv:
    cd srv && .venv/bin/pytest

# lint the FastAPI app
lint-srv:
    cd srv && .venv/bin/ruff check .

# ── combined ─────────────────────────────────────────────────────────────────

# run both dev servers concurrently (requires a terminal multiplexer or parallel)
dev:
    just dev-srv & just dev-web

# run all tests
test: test-web test-srv
