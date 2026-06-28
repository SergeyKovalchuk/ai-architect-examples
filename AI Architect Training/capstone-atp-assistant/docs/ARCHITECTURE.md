# Architecture — ATP Match Assistant

Technical architecture of the capstone, described with the **C4 model** (Context → Container → Component) plus a runtime sequence and a provider/mode view. Diagrams are Mermaid — they render on GitHub, in Obsidian, and in VS Code's Mermaid preview. A static `architecture.svg` is included for quick viewing.

---

## C4 Level 1 — System Context

Who uses the system and which external systems it depends on.

```mermaid
C4Context
title System Context — ATP Match Assistant

Person(user, "Player / Coach", "Asks about matches, weather, news, and on-court rules")

System(atp, "ATP Match Assistant", "Chatbot that routes a question to ATP data, weather, news, or a rules knowledge base and answers with citations")

System_Ext(llm, "Azure OpenAI / EPAM DIAL", "LLM (tool orchestration + answers) and text embeddings")
System_Ext(meteo, "Open-Meteo API", "Current weather (no API key)")
System_Ext(gnews, "Google News RSS", "Latest tennis headlines (no API key)")

Rel(user, atp, "Asks questions, reads answers", "HTTPS")
Rel(atp, llm, "Plans tool calls, generates grounded answers, embeds case notes", "HTTPS")
Rel(atp, meteo, "Fetches current weather", "HTTPS")
Rel(atp, gnews, "Fetches headlines", "HTTPS/RSS")
```

> Offline/mock mode replaces the three external systems with deterministic local logic, so the app, tests, and eval run with no keys and no network.

---

## C4 Level 2 — Containers

The deployable/runtime pieces and the data they read.

```mermaid
C4Container
title Container Diagram — ATP Match Assistant

Person(user, "Player / Coach")

Container_Boundary(sys, "ATP Match Assistant") {
  Container(web, "Web UI", "HTML + vanilla JS", "Chat page; keeps per-session history and posts it with each turn")
  Container(api, "API + Agent", "Node, Fastify, Vercel AI SDK", "POST /api/ask; routes the question to tools; rolling-window memory; offline 'mock' router")
  Container(atpmcp, "ATP Data MCP Server", "Node, @modelcontextprotocol/sdk (stdio), Arquero", "Tools: query_matches, head_to_head, player_summary")
  Container(wxmcp, "Weather MCP Server", "Node, MCP (stdio)", "Tool: get_weather")
  Container(newsmcp, "News MCP Server", "Node, MCP (stdio)", "Tool: get_news")
  Container(rag, "RAG Component", "Node, in-process", "Embeds + retrieves case notes; tool: search_case_notes")
  ContainerDb(csv, "atp_matches.csv", "CSV file", "ATP match results (sample / Kaggle)")
  ContainerDb(cases, "case notes", "Markdown files", "Supervisor-call precedents")
  ContainerDb(index, "embedding index", "In-memory", "Vectors of case-note chunks")
}

System_Ext(llm, "Azure OpenAI / EPAM DIAL", "LLM + embeddings")
System_Ext(meteo, "Open-Meteo API")
System_Ext(gnews, "Google News RSS")

Rel(user, web, "Uses", "HTTPS")
Rel(web, api, "POST /api/ask {question, history}", "JSON/HTTPS")
Rel(api, llm, "generateText(system, messages, tools)", "HTTPS")
Rel(api, atpmcp, "Calls tools", "stdio / MCP")
Rel(api, wxmcp, "Calls tool", "stdio / MCP")
Rel(api, newsmcp, "Calls tool", "stdio / MCP")
Rel(api, rag, "search_case_notes", "in-process call")
Rel(atpmcp, csv, "Reads + queries", "file")
Rel(rag, cases, "Loads + chunks", "file")
Rel(rag, index, "Builds / searches", "in-memory")
Rel(rag, llm, "Embeddings (live mode)", "HTTPS")
Rel(wxmcp, meteo, "Geocode + current weather", "HTTPS")
Rel(newsmcp, gnews, "Search feed", "HTTPS/RSS")
```

> **Note:** the RAG component runs **in-process inside the API + Agent container**; only the three MCP servers are separate processes. It is drawn as its own box here to make the retrieval path explicit. The static `architecture.svg` folds RAG into the API + Agent container (the more literal deployment view).

---

## C4 Level 3 — Components (inside "API + Agent")

How the agent process is wired internally.

```mermaid
C4Component
title Component Diagram — API + Agent process

Container(web, "Web UI", "HTML/JS")
ContainerDb(csv, "atp_matches.csv", "CSV")
ContainerDb(cases, "case notes", "Markdown")
System_Ext(llm, "Azure / DIAL", "LLM + embeddings")

Container_Boundary(api, "API + Agent (Node process)") {
  Component(server, "server.ts", "Fastify", "Routes /api/ask & /api/health; opens ONE MCP connection at boot and reuses it")
  Component(agent, "agent.ts", "Orchestrator", "route() intent router (mock) | LLM tool-calling (real); trimHistory() rolling window; citation extraction")
  Component(provider, "provider.ts + dial.ts", "Model wiring", "Builds Azure or DIAL chat model + system prompt")
  Component(config, "config.ts", "Config", "provider (azure|dial|mock) + offline flags")
  Component(mcpc, "mcp-client.ts", "MCP bridge", "Spawns + connects the 3 stdio MCP servers; exposes their tools as AI SDK tools")
  Component(ragtool, "rag-tool.ts", "RAG tool", "search_case_notes (AI SDK tool) + offline ragAnswer")
  Component(ragc, "rag.ts + embeddings.ts", "RAG core", "loadCorpus → chunk → embed → retrieve / ragContext")
  Component(eval, "eval.ts + golden.json", "Evaluation", "Routing / correctness / citation / safety metrics")
}

Rel(web, server, "POST /api/ask", "HTTPS")
Rel(server, agent, "ask(question, history)")
Rel(agent, config, "reads mode")
Rel(agent, provider, "chatModel()")
Rel(provider, llm, "chat completions", "HTTPS")
Rel(agent, mcpc, "tool set + callTool()")
Rel(agent, ragtool, "search_case_notes")
Rel(ragtool, ragc, "ragContext()")
Rel(ragc, cases, "read + embed")
Rel(ragc, llm, "embeddings (live)", "HTTPS")
Rel(eval, agent, "ask() over golden set")
```

---

## Runtime — multi-tool request (sequence)

A single question that fans out to data + weather + rules, in the live (LLM) path.

```mermaid
sequenceDiagram
    actor U as Player
    participant UI as Web UI
    participant API as Fastify /api/ask
    participant AG as Agent (Vercel AI SDK)
    participant LLM as Azure / DIAL
    participant MCP as MCP servers
    participant RAG as RAG component

    U->>UI: "H2H Nadal vs Federer, weather in Paris, can I challenge a line call?"
    UI->>API: POST {question, history}
    API->>AG: ask(question, trimHistory(history))
    AG->>LLM: generateText(system, messages, tools)
    LLM-->>AG: tool_call head_to_head(Nadal, Federer)
    AG->>MCP: head_to_head(...)
    MCP-->>AG: "3-3 (6 matches)"
    LLM-->>AG: tool_call get_weather(Paris)
    AG->>MCP: get_weather(Paris)
    MCP-->>AG: "22.5°C, mainly clear"
    LLM-->>AG: tool_call search_case_notes("line call")
    AG->>RAG: ragContext("line call")
    RAG-->>AG: chunks + case ids
    LLM-->>AG: final grounded answer (cites line-call-dispute)
    AG-->>API: {answer, toolsUsed, citations}
    API-->>UI: JSON
    UI-->>U: answer + 🔧 tool tags + 📎 citation
```

---

## Providers & execution modes

The same tool layer runs under three configurations (set in `.env`).

```mermaid
flowchart TD
    Q["Question + history"] --> AG["Agent (agent.ts)"]
    AG --> MODE{"PROVIDER?"}
    MODE -->|"azure / dial"| LLMP["LLM tool-calling<br/>(generateText, stepCountIs 6)"]
    MODE -->|"mock"| ROUTER["Deterministic intent router<br/>route() — keyword + player match"]
    LLMP --> TOOLS["Tool layer"]
    ROUTER --> TOOLS

    subgraph TOOLS["Shared tool layer"]
      direction LR
      T1["ATP MCP<br/>(Arquero/CSV)"]
      T2["Weather MCP"]
      T3["News MCP"]
      T4["search_case_notes<br/>(RAG)"]
    end

    TOOLS --> OFF{"OFFLINE?"}
    OFF -->|"0 (live)"| EXT["Open-Meteo · Google News · Azure/DIAL embeddings"]
    OFF -->|"1 (offline)"| LOCAL["Canned weather/news · hashing embeddings"]

    EXT --> ANS["Answer + toolsUsed + citations"]
    LOCAL --> ANS
```

**Notes**

- **MCP is real in every mode** — tools are always invoked through the stdio MCP servers; only the *orchestrator* (LLM vs deterministic router) and the *data source* (live vs canned) change.
- **Swap points:** dataframe engine is isolated in `datatable.ts` (Arquero → Danfo.js); the LLM provider is one line in `provider.ts`/`dial.ts`; the news source is one function in `news.ts`.
- **Scaling note:** MCP servers are separate processes (here spawned over stdio); they could be deployed independently behind a network MCP transport without changing the agent.
