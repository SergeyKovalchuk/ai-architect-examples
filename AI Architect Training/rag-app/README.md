# RAG Document Analyzer — TypeScript + Vercel AI SDK

A Retrieval-Augmented Generation app that ingests PDFs (and chart **images**),
answers questions with **citations**, **extracts structured data**, and
**visualizes** it as a pie chart + knowledge graph — with a built-in
**evaluation harness**.

Built for *AI Architect — Practical Task: RAG Creation*.

- **Framework:** Vercel AI SDK (`ai`) — provider-neutral, Zod structured output
- **Provider:** Azure OpenAI **or** EPAM DIAL (OpenAI-compatible) — plus an offline `mock` mode
- **App:** Node API (Fastify) + lightweight static frontend (Chart.js + vis-network)
- **No external vector DB** — file-backed store with cosine search

## Acceptance criteria coverage

| Requirement | Where |
|---|---|
| Analyze documents | `src/pdf.ts`, `src/chunk.ts`, `src/ingest.ts` |
| Extract & visualize data (pie + graph) | `src/extract.ts`, `public/index.html` (`/api/visualize`) |
| ≥1 evaluation metric, evaluated & demonstrated | `src/eval.ts` — **5 metrics** over a golden set |
| **Ninja: RAG eval (precision/recall/faithfulness)** | `src/eval.ts` |
| **Ninja: access-control-aware RAG** | `src/retrieve.ts`, `src/store.ts` (ACL filter before scoring) |
| **Ninja: multi-modal RAG (graphical content)** | `src/ai.ts` `describeImage`, `src/ingest.ts` (image docs) |
| Corpus update without full rebuild (bonus) | `src/store.ts` incremental upsert + content-hash skip in `src/ingest.ts` |

## Quick start

```bash
npm install
cp .env.example .env        # default PROVIDER=mock — runs with NO API key
npm run demo                # = ingest + eval (prints metrics)
npm run serve               # http://localhost:3000
```

### Use a real model (Azure or DIAL)
Edit `.env`:

```ini
# Azure OpenAI
PROVIDER=azure
AZURE_RESOURCE_NAME=...
AZURE_API_KEY=...
AZURE_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_EMBED_DEPLOYMENT=text-embedding-3-small
AZURE_VISION_DEPLOYMENT=gpt-4o

# …or EPAM DIAL (OpenAI-compatible)
PROVIDER=dial
DIAL_BASE_URL=https://ai-proxy.lab.epam.com
DIAL_API_KEY=...
DIAL_CHAT_MODEL=gpt-4o-mini
DIAL_EMBED_MODEL=text-embedding-3-small-1
DIAL_VISION_MODEL=gpt-4o
```

Then `npm run ingest -- --force && npm run eval && npm run serve`.

## How it works

```
PDF / image ─► extract ─► chunk ─► embed ─► file store (ACL + content-hash)
                                                  │
query ─► embed ─► ACL filter ─► cosine top-k ─► generate (grounded + citations)
                                                  │
                                       extract (Zod) ─► pie chart + graph
```

- **Grounded answers** use `generateObject` with a Zod schema; the model must cite
  the chunk ids it used and must refuse (`"I have no answer."`) when the context
  doesn't contain the answer.
- **Access control** is enforced *before* scoring: a chunk is only a retrieval
  candidate if its `allowedRoles` intersect the user's roles. Switch the "View as
  user" dropdown in the UI (guest / analyst / ceo) to see retrieval, answers, and
  even the charts change.
- **Multi-modal**: image files are turned into searchable text by a vision model
  (`describeImage`). The sample `helios_revenue_chart.png` is a pie chart; its
  regional values become retrievable. (In `mock` mode a sidecar `.txt` stands in
  for the vision model so the pipeline is still demonstrable offline.)
- **Incremental corpus update**: each chunk stores a content hash; re-running
  `ingest` skips unchanged docs and only re-embeds new/changed ones — no full
  index rebuild.

## Evaluation

`npm run eval` scores a 10-question golden set (`data/golden.json`) and writes
`data/eval-report.json`:

| Metric | Meaning |
|---|---|
| Retrieval Precision@k | fraction of retrieved chunks from a relevant doc |
| Retrieval Recall@k | was the relevant doc retrieved at all |
| Answer Correctness | expected key facts present in the answer |
| Faithfulness / Groundedness | is every claim supported by the context (LLM-judge; token-overlap in mock) |
| ACL Safety Rate | a **guest** asking a restricted question must NOT leak the answer |

**Demonstrated run (offline `mock` provider, top_k=3, 13 chunks):**

```
Retrieval Precision@k : 53.3%
Retrieval Recall@k    : 100.0%
Answer Correctness    : 90.0%
Faithfulness          : 100.0%
ACL Safety Rate       : 100.0%
```

> `mock` mode uses deterministic hashing embeddings + an extractive answerer so
> the whole pipeline and the eval harness run with **no API key** (great for CI).
> Correctness/precision improve further with a real Azure/DIAL model, which also
> performs true vision extraction and LLM-as-judge faithfulness.

## Data
- `data/docs/` — sample corpus: 3 company reports (PDF), 1 confidential M&A memo (PDF, exec-only), 1 revenue chart (PNG, multimodal).
- `data/acl.json` — per-document allowed roles.
- `data/golden.json` — eval users + questions.
- Swap in Kaggle PDFs: drop files in `data/docs/`, add an `acl.json` entry, `npm run ingest`.

## Project layout
```
src/  ai.ts config.ts pdf.ts chunk.ts store.ts retrieve.ts rag.ts extract.ts eval.ts ingest.ts server.ts util.ts types.ts
public/index.html   data/   .env.example
```
