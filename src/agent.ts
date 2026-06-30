// The orchestrator. Two paths share one tool layer (MCP tools + RAG tool):
//   - real (azure/dial): the LLM plans tool calls.
//   - mock (offline):     a deterministic intent router (route) calls tools.
import { generateText, stepCountIs, Output } from "ai";
import { z } from "zod";
import { isMock, config } from "./config.js";
import { chatModel, SYSTEM_PROMPT } from "./provider.js";
import { startMcp, type McpHandle } from "./mcp-client.js";
import { makeRagTool, ragAnswer } from "./rag-tool.js";
import { knownPlayers } from "./atp.js";
import { ANONYMOUS, type User } from "./auth.js";
import { checkInput, guardOutput } from "./guardrails.js";

export interface AgentResult {
  answer: string; toolsUsed: string[]; citations: string[]; refused: boolean;
  blocked?: boolean;        // input guardrail tripped
  outputRedacted?: boolean; // output guardrail scrubbed secrets/PII
}

// Structured final answer: the model must return this shape (not free text).
const answerSchema = z.object({
  answer: z.string().describe("The grounded answer for the user, based only on tool output."),
  citations: z.array(z.string()).describe("case ids returned by search_case_notes that support the answer; [] if none used."),
  refused: z.boolean().describe("true if the question is out of scope or cannot be answered from the tools."),
});

/** Keep only citations that were actually returned by search_case_notes (no fabricated sources). */
export function enforceCitations(modelCitations: string[], allowed: Set<string>): string[] {
  const valid = [...new Set(modelCitations)].filter((c) => allowed.has(c));
  // If the model cited nothing but case notes were retrieved, fall back to the real sources.
  if (valid.length === 0 && allowed.size > 0) return [...allowed];
  return valid;
}

/* ─────────────────── intent routing (pure, testable) ─────────────────── */
export type Intent =
  | { tool: "search_case_notes"; query: string }
  | { tool: "get_weather"; location: string }
  | { tool: "get_news"; topic: string }
  | { tool: "head_to_head"; player1: string; player2: string }
  | { tool: "player_summary"; player: string }
  | { tool: "query_matches"; player?: string; surface?: string; year?: number };

const RULE_RE = /\b(rule|allowed|can i|dispute|line call|hawk-?eye|challenge|coaching|medical timeout|mto|code violation|penalty|supervisor|referee|shot clock|ball mark|obscenity|default|suspend|extreme heat)\b/i;
const WEATHER_RE = /\b(weather|temperature|forecast|rain|hot|cold|windy?|sunny|humid)\b/i;
const NEWS_STRONG_RE = /\b(news|headline|headlines|stories|announce)\b/i;
const NEWS_WEAK_RE = /\b(latest|happening)\b/i;
const H2H_RE = /\b(head[- ]?to[- ]?head|h2h|vs\.?|versus|against)\b/i;
const SUMMARY_RE = /\b(record|summary|titles?|wins?|win\s*%|how many|stats|won)\b/i;
const SURFACES = ["clay", "grass", "hard"];

function extractAfter(re: RegExp, question: string): string | undefined {
  const m = question.match(re);
  return m?.[1]?.trim();
}

function matchPlayers(question: string): string[] {
  const q = question.toLowerCase();
  const found: { name: string; pos: number }[] = [];
  for (const full of knownPlayers()) {
    const last = full.split(" ").slice(-1)[0].toLowerCase();
    const pos = q.indexOf(full.toLowerCase()) >= 0 ? q.indexOf(full.toLowerCase()) : q.indexOf(last);
    if (pos >= 0) found.push({ name: full, pos });
  }
  // unique by name, in order of appearance
  const seen = new Set<string>();
  return found.sort((a, b) => a.pos - b.pos).filter((f) => !seen.has(f.name) && seen.add(f.name)).map((f) => f.name);
}

export function route(question: string): Intent[] {
  const q = question.toLowerCase();
  const intents: Intent[] = [];

  if (RULE_RE.test(q)) intents.push({ tool: "search_case_notes", query: question });
  if (WEATHER_RE.test(q)) {
    const city = extractAfter(/\b(?:in|at|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/, question) ?? "Melbourne";
    intents.push({ tool: "get_weather", location: city });
  }
  // Strong news words ("news"/"headlines") always trigger; the weak word "latest"
  // only triggers when there's no competing rules intent (avoids false positives).
  if (NEWS_STRONG_RE.test(q) || (NEWS_WEAK_RE.test(q) && !RULE_RE.test(q))) {
    // Only override the default topic for an explicit "news about/on X".
    const topic = extractAfter(/\b(?:news|headlines?)\s+(?:about|on|of|regarding)\s+([A-Za-z][A-Za-z ]+)/i, question)
      ?.split(/[.?!,]/)[0].trim() ?? "tennis";
    intents.push({ tool: "get_news", topic });
  }

  const players = matchPlayers(question);
  if (players.length >= 2 && (H2H_RE.test(q) || !SUMMARY_RE.test(q))) {
    intents.push({ tool: "head_to_head", player1: players[0], player2: players[1] });
  } else if (players.length === 1 && (SUMMARY_RE.test(q) || /record|titles?|summary/.test(q))) {
    intents.push({ tool: "player_summary", player: players[0] });
  } else {
    const surface = SURFACES.find((s) => q.includes(s));
    const year = Number(q.match(/\b(19|20)\d{2}\b/)?.[0]) || undefined;
    // Only treat surface/year as a data search when there's a real match-data intent
    // (the word "match" or a named player) AND it isn't a rules question.
    const dataIntent = q.includes("match") || players.length > 0;
    if ((surface || year) && dataIntent && !RULE_RE.test(q)) {
      intents.push({ tool: "query_matches", player: players[0], surface: surface ? surface[0].toUpperCase() + surface.slice(1) : undefined, year });
    }
  }
  return intents;
}

/* ─────────────────────────── execution ─────────────────────────── */
export interface ChatMessage { role: "user" | "assistant"; content: string; }

// Rolling-window memory: cap by recent turns AND a char budget (~token proxy),
// so context/cost stay bounded no matter how long the conversation gets.
const HISTORY_MAX_MESSAGES = 12;     // keep at most the last 12 turns
const HISTORY_MAX_CHARS = 6000;      // ~1.5k tokens of history

export function trimHistory(history: ChatMessage[]): ChatMessage[] {
  let kept = history.slice(-HISTORY_MAX_MESSAGES);
  let total = kept.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  while (kept.length > 2 && total > HISTORY_MAX_CHARS) {
    total -= kept[0].content?.length ?? 0;
    kept = kept.slice(1);
  }
  return kept;
}

export async function ask(question: string, mcp?: McpHandle, history: ChatMessage[] = [], user: User = ANONYMOUS): Promise<AgentResult> {
  // INPUT guardrail (defense-in-depth on top of untrusted-data delimiting).
  const input = checkInput(question);
  if (!input.allowed) {
    return { answer: "I can't help with that request.", toolsUsed: [], citations: [], refused: true, blocked: true, outputRedacted: false };
  }
  const handle = mcp ?? (await startMcp());
  try {
    const res = isMock ? await mockExecute(question, handle, user) : await llmOrchestrate(question, handle, history, user);
    // OUTPUT guardrail: redact any secrets/PII before the answer leaves the system.
    const g = guardOutput(res.answer);
    return { ...res, answer: g.answer, blocked: false, outputRedacted: g.redacted };
  } finally {
    if (!mcp) await handle.close();
  }
}

async function mockExecute(question: string, mcp: McpHandle, user: User): Promise<AgentResult> {
  const intents = route(question);
  if (intents.length === 0) {
    return {
      answer: "I can help with ATP match data, weather at a venue, the latest tennis news, and on-court rules/precedents. Try one of those.",
      toolsUsed: [], citations: [], refused: true,
    };
  }
  const parts: string[] = [];
  const toolsUsed: string[] = [];
  const citations: string[] = [];
  for (const it of intents) {
    if (it.tool === "search_case_notes") {
      const r = await ragAnswer(it.query, user.roles);
      parts.push(r.text); citations.push(...r.citations); toolsUsed.push("search_case_notes");
    } else if (it.tool === "get_weather") {
      parts.push((await mcp.callTool("get_weather", { location: it.location })).text); toolsUsed.push("get_weather");
    } else if (it.tool === "get_news") {
      parts.push((await mcp.callTool("get_news", { topic: it.topic, limit: 3 })).text); toolsUsed.push("get_news");
    } else if (it.tool === "head_to_head") {
      parts.push((await mcp.callTool("head_to_head", { player1: it.player1, player2: it.player2 })).text); toolsUsed.push("head_to_head");
    } else if (it.tool === "player_summary") {
      parts.push((await mcp.callTool("player_summary", { player: it.player })).text); toolsUsed.push("player_summary");
    } else if (it.tool === "query_matches") {
      const { tool: _t, ...args } = it;
      parts.push((await mcp.callTool("query_matches", args as any)).text); toolsUsed.push("query_matches");
    }
  }
  return { answer: parts.join("\n\n"), toolsUsed, citations, refused: false };
}

async function llmOrchestrate(question: string, mcp: McpHandle, history: ChatMessage[] = [], user: User = ANONYMOUS): Promise<AgentResult> {
  // Thread prior turns (rolling window) so follow-ups ("yes", "и что дальше?") keep context.
  const messages = [...trimHistory(history), { role: "user" as const, content: question }];
  // RAG tool is scoped to the user's roles (ACL-aware retrieval).
  const tools = { ...mcp.aiTools, ...makeRagTool(user.roles) };
  const result = await generateText({
    model: chatModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(config.limits.maxSteps), // bounded agent loop
    maxOutputTokens: config.limits.maxOutputTokens, // cap output (cost/DoS)
    // Final answer is a typed object (tools still run during the steps).
    output: Output.object({ schema: answerSchema }),
  });
  const toolsUsed = [...new Set(result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName)))];

  // Build the set of case ids actually returned by search_case_notes this run —
  // the ONLY citations we allow (prevents hallucinated/fabricated sources).
  const allowed = new Set<string>();
  const toolResults: any[] = (result as any).toolResults ?? result.steps.flatMap((s: any) => s.toolResults ?? []);
  for (const tr of toolResults) {
    if (tr?.toolName !== "search_case_notes") continue;
    const out = tr.output ?? tr.result ?? "";
    const text = typeof out === "string" ? out : JSON.stringify(out);
    const m = text.match(/case ids:\s*([^\n]+)/i);
    if (m) for (const id of m[1].split(",")) { const v = id.trim(); if (v) allowed.add(v); }
  }

  const obj = (result as any).output as z.infer<typeof answerSchema> | undefined;
  const answer = (obj?.answer ?? result.text ?? "").trim();
  const citations = enforceCitations(obj?.citations ?? [], allowed);
  return { answer, toolsUsed, citations, refused: obj?.refused ?? false };
}
