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

<!-- Describe your running prototype and link to the relevant code -->

- **Code location:** [link or path]
- **How to run locally:**

```bash
# Add setup / run instructions here
```

---

### Deliverable 2 (Optional) — Locally-hosted OSS models

<!-- If applicable, describe any OSS models used instead of OpenAI API models -->

---

### Deliverable 3 (Optional) — Public deployment

<!-- If deployed publicly, include the URL and the tool used -->

- **Deployment URL:**
- **Deployment tool:**

---

## 🧪 Task 5: Eval Baseline

### Deliverable 1 — RAGAS evaluation results

<!-- Provide your RAGAS results table. Include faithfulness, context precision, context recall, and any additional metrics -->

| Metric            | Score |
| ----------------- | ----- |
| Faithfulness      |       |
| Context Precision |       |
| Context Recall    |       |
| _(add others)_    |       |

---

### Deliverable 2 — Conclusions from baseline evaluation

<!-- What does the baseline tell you about the performance and effectiveness of your pipeline? -->

---

## 🧠 Task 6: Retriever Upgrade

### Deliverable 1 — Chosen advanced retrieval technique and rationale (1–2 sentences)

<!-- Name the technique and explain why you believe it will improve retrieval for your use case -->

---

### Deliverable 2 — Implementation

<!-- Describe the implementation and link to the relevant code -->

- **Code location:** [link or path]

---

### Deliverable 3 — Performance comparison (RAGAS results)

<!-- Provide a side-by-side comparison of baseline vs. upgraded retriever -->

| Metric            | Baseline | Upgraded Retriever | Delta |
| ----------------- | -------- | ------------------ | ----- |
| Faithfulness      |          |                    |       |
| Context Precision |          |                    |       |
| Context Recall    |          |                    |       |
| _(add others)_    |          |                    |       |

<!-- Summarize your conclusions from this comparison -->

---

## 🎬 Task 7: Next Steps

### Deliverable 1 — Will you keep Dense Vector Retrieval for Demo Day?

<!-- State your decision and explain your reasoning -->

---

## 📎 Additional Links

| Asset                     | Link |
| ------------------------- | ---- |
| GitHub Repo               |      |
| Loom Demo Video (≤ 5 min) |      |
| This document             |      |
