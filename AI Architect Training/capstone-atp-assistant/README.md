# Capstone — ATP Match Assistant

A chatbot that composes the two prior course projects — **RAG** + **Agent/MCP** — and extends them with a **data-query MCP server** over an ATP matches CSV. An agent routes each question to the right source:

- **ATP data MCP** — match queries over a CSV via a dataframe engine (head-to-head, player summary, filtered match search)
- **Weather MCP** — conditions at a match venue *(Part 2)*
- **News MCP** — latest tennis news *(Part 2)*
- **RAG** — grounded answers from a corpus of "problematic match / supervisor-call" case notes, queryable by players, with citations *(Part 3)*

**Stack:** All-TypeScript · Vercel AI SDK (agent) · `@modelcontextprotocol/sdk` (MCP) · Arquero (dataframe) · Vitest (tests) · Azure/DIAL + offline-mock providers · CLI + lightweight web.

> **Status:** built incrementally. ✅ Part 1 (ATP data MCP + tests). ⏳ Parts 2–6 to come.

## Build plan
1. ✅ **ATP data MCP server** (Arquero) + Vitest tests + sample CSV
2. ⏳ Weather + News MCP servers
3. ⏳ RAG over supervisor-call case notes (+ tests)
4. ⏳ Agent orchestrator (RAG + 3 MCP tools)
5. ⏳ Chat frontend (CLI + web)
6. ⏳ Evaluation harness + SUBMISSION

## Quick start
```bash
npm install
npm test            # Vitest — currently 12/12 passing (ATP data layer)
npm run typecheck   # tsc --noEmit
```

## Part 1 — ATP data MCP server

### Layout
```
data/atp_matches.csv     sample matches (replaceable with the real Kaggle file)
src/datatable.ts         thin Arquero wrapper (MatchTable) — the ONLY file that imports Arquero
src/atp.ts               pure query functions: queryMatches, headToHead, playerSummary
src/mcp/atp-server.ts    MCP server exposing those as 3 tools (stdio)
test/atp.test.ts         Vitest suite (12 tests)
```

### MCP tools
| Tool | Purpose |
|---|---|
| `query_matches` | Filter by player / surface / year / tournament / round → count + sample |
| `head_to_head` | Win-loss record between two players + their match list |
| `player_summary` | W-L, win %, titles (final-round wins), per-surface breakdown |

### Swapping the dataframe engine
All Arquero calls live in `src/datatable.ts` behind the `MatchTable` interface. To switch to **Danfo.js** ("Pandas for JS") on a machine where it installs, reimplement just that file — `atp.ts`, the MCP server, and the tests are unchanged.

> Danfo.js was the originally chosen engine, but it can't be installed in the build sandbox (its `xlsx`/TensorFlow dependencies are blocked), so Arquero is used here to keep the mandatory tests verifiable. The wrapper keeps Danfo.js a drop-in option.

### Using the real Kaggle dataset
The shipped CSV is a small curated sample so tests have known values. To use real data, download the ATP matches dataset and replace `data/atp_matches.csv` (keep the columns `tourney_name, surface, tourney_date, round, winner_name, loser_name, score`):
```bash
curl -L -o ~/Downloads/atp-matches-dataset.zip \
  https://www.kaggle.com/api/v1/datasets/download/gmadevs/atp-matches-dataset
```

### Tests
`npm test` → **12 passing**, covering CSV load + year derivation, `query_matches` filters, `head_to_head` (incl. order-independence and date sorting), and `player_summary` aggregates. Test constants were pinned to values computed from the sample CSV, then hand-verified.
