# AIE9 Certification Challenge — Written Submission

> Replace each placeholder block with your written response or a link to the relevant file/doc in your codebase.

---

## 🧩 Task 1: Problem + Audience

### Deliverable 1 — One-sentence problem description

<!-- Write your 1-sentence problem description here -->

---

### Deliverable 2 — Why this is a problem for your specific user (1–2 paragraphs)

<!-- Describe your user (job title, role, context) and explain why this problem matters to them -->

---

### Deliverable 3 — Evaluation questions / input-output pairs

<!-- List the questions or input-output pairs you will use to evaluate your application -->

| # | Input (Question) | Expected Output |
|---|-----------------|-----------------|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |

---

## 💡 Task 2: Solution

### Deliverable 1 — Proposed solution description (1–2 paragraphs)

<!-- Describe how the solution will look and feel to the user, and the tools you plan to use -->

---

### Deliverable 2 — Infrastructure diagram + tooling choices

<!-- Insert or link your infrastructure diagram here (image, Excalidraw, Miro, etc.) -->

| Component | Tool / Choice | One-sentence rationale |
|-----------|--------------|------------------------|
| LLM(s) | | |
| Agent orchestration framework | | |
| Tool(s) | | |
| Embedding model | | |
| Vector database | | |
| Monitoring tool | | |
| Evaluation framework | | |
| User interface | | |
| Deployment tool | | |
| Other | | |

---

### Deliverable 3 — RAG and agent components

<!-- Describe exactly what the RAG component does and exactly what the agent component does in your project -->

---

## 🔐 Task 3: Data + Keys

> **Role: AI Systems Engineer.** The goal here is to move from planning to doing: collect your own data for RAG and confirm your external API access is working. At minimum your solution needs (1) your own personal/domain data uploaded to the app, and (2) the ability to search publicly available data via an agentic tool (e.g. Tavily).

### Deliverable 1 — Default chunking strategy

<!-- Describe the chunking strategy you are using for your personal/domain data (e.g. fixed-size, recursive, semantic, document-based). Explain why this strategy fits your data type and use case. -->

---

### Deliverable 2 — Data source, external API, and how they interact during usage

<!-- 
Cover all three of the following:
1. Your personal/domain data: what it is, where it comes from, and what role it plays (the RAG knowledge base)
2. The external API you are using (e.g. Tavily for web search): what it is and what role it plays (the agentic search tool)
3. How the two interact during a typical user session — e.g. when does the agent hit the vector store vs. call the external API?
-->

---

### User questions (cross-check)

<!-- List the specific questions your target user is likely to ask of this application. These should inform both your data collection and your evaluation set in Task 5. -->

| # | Question |
|---|----------|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |

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

| Metric | Score |
|--------|-------|
| Faithfulness | |
| Context Precision | |
| Context Recall | |
| *(add others)* | |

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

| Metric | Baseline | Upgraded Retriever | Delta |
|--------|----------|--------------------|-------|
| Faithfulness | | | |
| Context Precision | | | |
| Context Recall | | | |
| *(add others)* | | | |

<!-- Summarize your conclusions from this comparison -->

---

## 🎬 Task 7: Next Steps

### Deliverable 1 — Will you keep Dense Vector Retrieval for Demo Day?

<!-- State your decision and explain your reasoning -->

---

## 📎 Additional Links

| Asset | Link |
|-------|------|
| GitHub Repo | |
| Loom Demo Video (≤ 5 min) | |
| This document | |