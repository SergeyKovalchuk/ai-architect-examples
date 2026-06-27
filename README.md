# AI Architect Examples

Hands-on examples, homework, and reference notes from the **EPAM AI Architect Working Group** training program — from prompt engineering and RAG to agents, security, and compliance.

> Practical code you can run locally · Structured homework submissions · An Obsidian knowledge base for the full curriculum

---

## What's inside

| Area | Description | Start here |
|------|-------------|------------|
| **RAG app** | Document Q&A with citations, structured extraction, charts, and an eval harness | [`AI Architect Training/rag-app/README.md`](AI%20Architect%20Training/rag-app/README.md) |
| **Weather & News agent** | Agentic orchestrator with MCP servers (Open-Meteo + Google News RSS) | [`AI Architect Training/weather-news-agent/README.md`](AI%20Architect%20Training/weather-news-agent/README.md) |
| **Security (OWASP)** | Vulnerable vs mitigated prompt-injection examples | [`AI Architect Training/HW_4.1_Security_OWASP/`](AI%20Architect%20Training/HW_4.1_Security_OWASP/) |
| **Second Brain** | Obsidian vault — modules, concepts, wikilinks, graph view | [`AI Architect Training/AI Architect Brain/Home.md`](AI%20Architect%20Training/AI%20Architect%20Brain/Home.md) | PRIVATE

---

## Quick start (runnable apps)

Both apps support **offline/mock mode** — no API keys required for a first run.

### RAG Document Analyzer

```bash
cd "AI Architect Training/rag-app"
npm install
cp .env.example .env
npm run demo    # ingest + eval
npm run serve   # http://localhost:3000
```

### Weather & News Agent

```bash
cd "AI Architect Training/weather-news-agent"
npm install
cp .env.example .env
npm run serve   # http://localhost:3000
```

---

## Homework & deliverables

| Module | Topic | Location |
|--------|-------|----------|
| 2.1 | Self-reflection / ReAct prompt (ATP tennis analysis) | [`HW_2.1_Self-Reflection_Prompt_Tennis_ATP.md`](AI%20Architect%20Training/HW_2.1_Self-Reflection_Prompt_Tennis_ATP.md) |
| 3.x | RAG practical task | [`rag-app/SUBMISSION.md`](AI%20Architect%20Training/rag-app/SUBMISSION.md) |
| 3.5 | Agentic AI (MCP) | [`weather-news-agent/SUBMISSION.md`](AI%20Architect%20Training/weather-news-agent/SUBMISSION.md) |
| 4.1 | OWASP LLM security | [`HW_4.1_Security_OWASP/`](AI%20Architect%20Training/HW_4.1_Security_OWASP/) |

---

## Repository layout

```
ai-architect-examples/
├── README.md
└── AI Architect Training/
    ├── AI Architect Brain/     # Obsidian knowledge base (PRIVATE)
    ├── rag-app/                # RAG + eval harness (TypeScript)
    ├── weather-news-agent/     # MCP agent orchestrator (TypeScript)
    ├── HW_4.1_Security_OWASP/  # Security homework
    └── HW_2.1_*.md             # Prompt engineering homework
```

---

## Curriculum coverage

- **Prompt engineering** — anatomy, strategies (CoT, ReAct, CoVe, self-reflection)
- **Solution lifecycle** — business case, requirements, feasibility
- **RAG** — chunking, retrieval, multimodal docs, evaluation metrics
- **Agents & MCP** — tool use, orchestration, bounded multi-step loops
- **Security & compliance** — OWASP LLM Top 10, guardrails, EU AI Act, GDPR

Open the **Second Brain** vault in Obsidian and use graph view (`Cmd/Ctrl+G`) to explore modules and concepts visually.

---

*EPAM Proprietary & Confidential — internal training materials.*
