# Weather & News Agent — Agentic AI (Module 3.5)

A small **agent orchestrator** that answers questions about **current weather** and the
**latest news** by calling two **MCP servers**:

- **Weather MCP** → Open-Meteo (no API key)
- **News MCP** → Google News RSS (no API key; swappable for GNews.io / NewsAPI / TheNewsAPI)

Built with the **Vercel AI SDK** for the orchestrator and the official
**`@modelcontextprotocol/sdk`** for the MCP servers and clients. Kept deliberately small.

## Architecture

```
        ┌──────────────── Orchestrator agent (Vercel AI SDK) ────────────────┐
 user → │  generateText(model, tools, stopWhen) — LLM decides which tool(s)   │ → answer
        └───────────────▲───────────────────────────────▲────────────────────┘
                        │ MCP (stdio)                    │ MCP (stdio)
                ┌───────┴────────┐               ┌───────┴────────┐
                │  weather-mcp   │               │   news-mcp     │
                │  get_weather() │               │   get_news()   │
                │  → Open-Meteo  │               │ → Google News  │
                └────────────────┘               └────────────────┘
```

The agent connects to both MCP servers, lists their tools, and exposes them to the model.
The LLM plans the calls (weather? news? both?) in a bounded multi-step loop
(`stopWhen: stepCountIs(5)`). The system prompt scopes the agent to weather/news only.

## Quick start

```bash
npm install
cp .env.example .env     # defaults: PROVIDER=mock, OFFLINE=1 → runs with NO keys, NO network
npm run ask -- "What's the weather in Tokyo and the latest technology news?"
npm run eval
```

### Run for real
Edit `.env`:
```ini
PROVIDER=azure          # or: dial
OFFLINE=0               # hit the real Open-Meteo + Google News APIs
AZURE_RESOURCE_NAME=...
AZURE_API_KEY=...
AZURE_CHAT_DEPLOYMENT=gpt-4o-mini
```
Then `npm run ask -- "Is it raining in London?"`.

## Two run modes (so it's always demonstrable)

| Setting | Orchestration | Data |
|---|---|---|
| `PROVIDER=mock` | deterministic intent router (no LLM) | — |
| `PROVIDER=azure`/`dial` | **LLM decides tool calls** | — |
| `OFFLINE=1` | — | canned weather/news (no network) |
| `OFFLINE=0` | — | live Open-Meteo + Google News |

`mock`+`OFFLINE=1` lets the whole agent and the evaluation run with no key and no
internet (great for CI). The MCP layer is real in **every** mode — tools are always
invoked through stdio MCP servers.

## Evaluation

`npm run eval` runs a 7-question golden set (`data/golden.json`) and reports three metrics:

| Metric | What it checks |
|---|---|
| **Tool-selection accuracy** | did the agent call exactly the right MCP tool(s)? |
| **Answer correctness** | are the expected facts present in the answer? |
| **Safety (scope) rate** | are out-of-scope questions declined with no tool calls? |

**Demonstrated run (`mock`, `OFFLINE=1`):**
```
Tool-selection accuracy : 100.0%
Answer correctness      : 100.0%
Safety (scope) rate     : 100.0%
```

## Files
```
src/mcp/weather-server.ts   MCP server — get_weather (Open-Meteo)
src/mcp/news-server.ts      MCP server — get_news (Google News RSS)
src/mcp-client.ts           spawn + connect MCP clients, expose tools to the AI SDK
src/agent.ts                orchestrator (LLM path + offline mock path)
src/provider.ts             Azure / DIAL model + system prompt
src/ask.ts                  CLI
src/eval.ts                 evaluation harness
data/golden.json            evaluation dataset
```

## Notes / best practices applied
- **Separation of concerns:** each capability is its own MCP server (reusable by any MCP client, not just this agent).
- **Bounded agent loop** with an explicit step cap and a scoping system prompt (safety).
- **Grounding:** answers come only from tool results; the agent declines out-of-scope asks.
- **No vendor lock-in:** provider swap is one line; news source swap is one function.
- **Always runnable:** offline + mock modes mean the grader can run it without any keys.
