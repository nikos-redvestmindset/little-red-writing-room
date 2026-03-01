# AIE9 Certification Challenge — Written Submission

> Replace each placeholder block with your written response or a link to the relevant file/doc in your codebase.

---

## 🧩 Task 1: Problem + Audience

### Deliverable 1 — One-sentence problem description

Fiction writers lack an interactive tool to externalize, interrogate, and stress-test their characters' psychology, settings, and story structure while actively developing a manuscript.

---

### Deliverable 2 — Why this is a problem for your specific user (1–2 paragraphs)

See [PRODUCT.md — Why This Is a Problem for the Specific User](./docs/PRODUCT.md#why-this-is-a-problem-for-the-specific-user)

---

### Deliverable 3 — Evaluation questions / input-output pairs

See [PRODUCT.md — Evaluation Questions / Input-Output Pairs](./docs/PRODUCT.md#evaluation-questions--input-output-pairs) for the full table of 10 test scenarios using the [sample dataset](./notebooks/sample_data).

---

## 💡 Task 2: Solution

### Deliverable 1 — Proposed solution description (1-2 paragraphs)

See [PRODUCT.md — Features & User Experience](./docs/PRODUCT.md#features--user-experience) for the full description of Phase 1 (Character Interview Mode) and Phase 2 (Scenario Simulation Mode).

---

### Deliverable 2 — Infrastructure diagram + tooling choices

See [ARCHITECTURE.md — Infrastructure Architecture](./docs/ARCHITECTURE.md#infrastructure-architecture) for the full Mermaid diagram and layer descriptions.

| Component                     | Tool / Choice                                          | One-sentence rationale                                                     |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| LLM(s)                        | GPT-4o                                                 | High-quality character voice and reasoning for in-character responses      |
| Agent orchestration framework | LangGraph                                              | Stateless graph with supervisor pattern for clean multi-agent coordination |
| Tool(s)                       | Character RAG Tool, Tavily Search Tool                 | RAG for author's own material; Tavily for external writing craft queries   |
| Embedding model               | OpenAI `text-embedding-3-small`                        | Cost-effective, high-quality embeddings for dense retrieval                |
| Vector database               | Qdrant Cloud                                           | Metadata filtering enables taxonomy-based hybrid retrieval                 |
| Monitoring tool               | LangSmith                                              | Native LangGraph tracing with retrieval chain inspection                   |
| Evaluation framework          | RAGAS                                                  | Faithfulness, context precision, context recall metrics                    |
| User interface                | Next.js (Vercel)                                       | SSE streaming for real-time character responses                            |
| Deployment tool               | Render (backend), Modal (ingestion), Vercel (frontend) | Separates concerns: API hosting, GPU-friendly batch jobs, static frontend  |
| Other                         | Supabase (Auth, Postgres, Storage), Cohere Rerank      | Auth/data persistence; reranking improves retrieval quality                |

---

### Deliverable 3 — RAG and agent components

**RAG Component:** Retrieves grounding context from the writer's uploaded documents via Qdrant. See [ARCHITECTURE.md — Retrieval Tool](./docs/ARCHITECTURE.md#retrieval-tool-langchain-tool) for dense vector search, taxonomy filtering (Option B), and Cohere reranking.

**Agent Component:** A LangGraph supervisor orchestrates intent classification, tool calls, and delegation to sub-agents. See [ARCHITECTURE.md — Agent Graph](./docs/ARCHITECTURE.md#agent-graph) for the full flow including Gap Detection and Avatar agents.

---

## 🔐 Task 3: Data + Keys

> **Role: AI Systems Engineer.** The goal here is to move from planning to doing: collect your own data for RAG and confirm your external API access is working. At minimum your solution needs (1) your own personal/domain data uploaded to the app, and (2) the ability to search publicly available data via an agentic tool (e.g. Tavily).

### Deliverable 1 — Default chunking strategy

**Baseline (Option A):** `RecursiveCharacterTextSplitter` with hierarchy `["\n\n", "\n", ".", " "]`, 500 tokens, 50 overlap. Fast ingestion, no LLM calls.

**Advanced (Option B):** `SemanticChunker` splits on embedding similarity to keep dialogue, action, and worldbuilding coherent as units.

See [ARCHITECTURE.md — Pipeline Comparison](./docs/ARCHITECTURE.md#pipeline-comparison) for full comparison.

---

### Deliverable 2 — Data source, external API, and how they interact during usage

1. **Personal data:** Writer-uploaded `.md` and `.docx` files (story drafts, character notes, worldbuilding). Stored in Supabase Storage, embedded and indexed in Qdrant. This is the primary RAG knowledge base.

2. **External API:** Tavily Search for writing craft queries (e.g., Story Grid theory) and external character/work references not in the author's material.

3. **Interaction:** The supervisor classifies intent and calls the Retrieval Tool first. Tavily is called conditionally when external references are detected or when the query falls outside the author's uploaded material. See [ARCHITECTURE.md — Option A vs Option B at Query Time](./docs/ARCHITECTURE.md#option-a-vs-option-b-at-query-time).

---

### User questions (cross-check)

See [PRODUCT.md — Evaluation Questions](./docs/PRODUCT.md#evaluation-questions--input-output-pairs) for the full set. Sample questions:

| #   | Question                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | "If PurpleFrog had to choose between reaching her brother and following OchraMags's evacuation order, what would she do?" |
| 2   | "How does PurpleFrog feel about the Underground?"                                                                         |
| 3   | "What is SnowRaven's greatest flaw as a character so far?"                                                                |
| 4   | "Describe the colony's classroom setting."                                                                                |
| 5   | "What would be a strong Inciting Incident for a sequel scene?"                                                            |

---

## 🤖 Task 4: Prototype

### Deliverable 1 — End-to-end prototype (local endpoint)

**Demo video:** [loom.com/share/16a1c2b8341d493d9a44e66c51aa739b](https://www.loom.com/share/16a1c2b8341d493d9a44e66c51aa739b)

Full setup and run instructions are in the [README](./README.md) (sections 1–8), including environment variables, migrations, and how to upload and extract the sample documents.

**Code locations:**

| Layer              | Path             | GitHub                                                                                            |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| Frontend (Next.js) | [`web/`](./web/) | [github.com/…/web](https://github.com/nikos-redvestmindset/little-red-writing-room/tree/main/web) |
| Backend (FastAPI)  | [`srv/`](./srv/) | [github.com/…/srv](https://github.com/nikos-redvestmindset/little-red-writing-room/tree/main/srv) |

**Quick start:**

```bash
# 1. Install all dependencies
just setup

# 2. Copy and fill in environment variables
cp srv/.env.example srv/.env        # add OpenAI, Supabase, Qdrant, Cohere, Tavily keys
# create web/.env.local             # add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Apply database migrations
just migrate

# 4. Start both servers
just dev-srv   # FastAPI on :8008
just dev-web   # Next.js on :3003
```

Log in at [http://localhost:3003](http://localhost:3003) with `test@lrwr.ink` / `abc123`, then follow the README to create characters, upload the sample documents from `notebooks/sample_data/`, and run extraction before chatting.

---

### Deliverable 2 (Optional) — Locally-hosted OSS models

Not applicable — the prototype uses OpenAI GPT-4o for LLM inference and `text-embedding-3-small` for embeddings.

---

### Deliverable 3 (Optional) — Public deployment

<!-- If deployed publicly, include the URL and the tool used -->

- **Deployment URL:**
- **Deployment tool:**

---

## 🧪 Task 5: Eval Baseline

### Deliverable 1 — RAGAS evaluation results

See [notebooks/rag_evaluation.ipynb](./notebooks/rag_evaluation.ipynb) Section 5 for the full run.

| Metric                | Score  |
| --------------------- | ------ |
| Faithfulness          | 0.6647 |
| Context Recall        | 0.3636 |
| Factual Correctness   | 0.6744 |
| Answer Relevancy      | 0.8533 |
| Context Entity Recall | 0.4583 |

---

### Deliverable 2 — Conclusions from baseline evaluation

Context recall (0.36) and faithfulness (0.66) are the clearest weak spots. Fixed 500-char chunks frequently lack character names because mid-scene passages rely on pronouns or implicit references, so character-focused dense similarity queries fail to surface the right chunks and the LLM is left with incomplete context. Answer relevancy (0.85) and factual correctness (0.67) are adequate but have room to grow. See [notebooks/rag_evaluation.ipynb](./notebooks/rag_evaluation.ipynb) Section 6 for the full analysis.

---

## 🧠 Task 6: Retriever Upgrade

### Deliverable 1 — Chosen advanced retrieval technique and rationale (1–2 sentences)

`SemanticChunker` (percentile breakpoint) with 3-sentence content overlap, an LLM taxonomy classification pass, and a metadata title prepended to each chunk's text before embedding — e.g. `[dialogue | plot_event | characters: PurpleFrog, OchraMags]`. Baking the taxonomy into `page_content` means character names and narrative tags are present in the embedding even for mid-scene chunks that only use pronouns in the original prose, directly targeting the baseline's context recall and faithfulness weaknesses.

---

### Deliverable 2 — Implementation

- **Code location:** [notebooks/rag_evaluation.ipynb](./notebooks/rag_evaluation.ipynb) Section 4 (Option B pipeline); supporting modules [`notebooks/lib/chunking.py`](./notebooks/lib/chunking.py) (semantic overlap + metadata title prepend) and [`notebooks/lib/classification.py`](./notebooks/lib/classification.py) (taxonomy classification)

---

### Deliverable 3 — Performance comparison (RAGAS results)

See [notebooks/rag_evaluation.ipynb](./notebooks/rag_evaluation.ipynb) Section 6 for the full analysis including LangSmith cost and latency data.

| Metric                | Baseline (Option A) | Upgraded (Option B) | Delta  |
| --------------------- | ------------------- | ------------------- | ------ |
| Faithfulness          | 0.6647              | 0.9474              | +0.282 |
| Context Recall        | 0.3636              | 0.8833              | +0.519 |
| Factual Correctness   | 0.6744              | 0.6867              | +0.013 |
| Answer Relevancy      | 0.8533              | 0.9277              | +0.075 |
| Context Entity Recall | 0.4583              | 0.5514              | +0.093 |

Option B wins on every metric. Context recall nearly triples (+142.6%) and faithfulness jumps to 0.95 (+42.4%) — the two areas where the baseline was weakest. Prepending the taxonomy title (with resolved character names) to each chunk's text before embedding means character names are present in the embedding even for mid-scene chunks that rely on pronouns in the original prose, making them retrievable for character-focused queries. Entity recall also improves meaningfully (+20.3%). The token and cost overhead roughly doubles (tokens +196%, cost +112%) with only modest latency impact (+13.6%), a trade-off well justified by the quality gains.

---

## 🎬 Task 7: Next Steps

### Deliverable 1 — Will you keep Dense Vector Retrieval for Demo Day?

Yes. I plan to continue building up the same application for Demo Day. There are a few things I'd like to do/polish:

1. Deployment to the cloud.
2. Extraction of not just characters but locations and other entities so the writer can start building a knowledge base of their IP.
3. Proper data persistence in Qdrant Cloud and Supabase for files and chunks.
4. Implement the "Recent chats" feature that is currently in mock phase.

---

## 📎 Additional Links

| Asset                     | Link                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GitHub Repo               | [github.com/nikos-redvestmindset/little-red-writing-room](https://github.com/nikos-redvestmindset/little-red-writing-room) |
| Loom Demo Video (≤ 5 min) | [loom.com/share/16a1c2b8341d493d9a44e66c51aa739b](https://www.loom.com/share/16a1c2b8341d493d9a44e66c51aa739b)             |
| This document             | [SUBMISSION.md](https://github.com/nikos-redvestmindset/little-red-writing-room/blob/main/SUBMISSION.md)                   |
