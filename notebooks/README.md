# Notebooks

RAG evaluation notebooks for Little Red Writing Room.

## Prerequisites

- Python 3.11+
- API keys for **OpenAI**, **Cohere**, and **LangChain** (LangSmith)

## Setup

The fastest way is via the project-root justfile:

```bash
just setup-notebooks
```

This creates a virtual environment at `notebooks/.venv` and installs all
dependencies (including Jupyter) from `pyproject.toml`.

### Manual setup

```bash
cd notebooks
uv sync --extra dev
```

### Environment variables

Create a `.env` file in the `notebooks/` directory:

```
OPENAI_API_KEY=sk-...
COHERE_API_KEY=...
LANGCHAIN_API_KEY=ls-...
```

The notebooks load this file automatically via `python-dotenv`.

## Running

Launch Jupyter Lab:

```bash
just run-notebook
```

Or open `rag_evaluation.ipynb` directly in Cursor / VS Code (select the
`.venv` kernel when prompted).

## Directory structure

```
notebooks/
├── lib/                   # Shared utility modules
│   ├── chains.py          # LCEL RAG chain builder
│   ├── classification.py  # Option B taxonomy classification
│   ├── data_loading.py    # Sample data loading helpers
│   └── evaluation.py      # RAGAS evaluation wrapper
├── sample_data/           # Test fiction files (PurpleFrog story)
├── references/            # Reference notebooks from coursework
├── rag_evaluation.ipynb   # Main evaluation notebook (Tasks 5 & 6)
└── pyproject.toml         # Python dependencies
```
