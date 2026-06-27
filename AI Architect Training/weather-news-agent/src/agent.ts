// The orchestrator agent. Two execution paths share one MCP tool layer:
//   - real (azure/dial): the LLM decides which MCP tools to call (multi-step).
//   - mock (offline):     a deterministic intent router calls the MCP tools.
import { generateText, stepCountIs } from "ai";
import { isMock } from "./config.js";
import { chatModel, SYSTEM_PROMPT } from "./provider.js";
import { startMcp, type McpHandle } from "./mcp-client.js";

export interface AgentResult {
  answer: string;
  toolsUsed: string[];
}

export async function ask(question: string, mcp?: McpHandle): Promise<AgentResult> {
  const handle = mcp ?? (await startMcp());
  try {
    return isMock ? await mockOrchestrate(question, handle) : await llmOrchestrate(question, handle);
  } finally {
    if (!mcp) await handle.close();
  }
}

/* ── Real orchestration: the LLM plans tool calls over MCP ── */
async function llmOrchestrate(question: string, handle: McpHandle): Promise<AgentResult> {
  const result = await generateText({
    model: chatModel(),
    system: SYSTEM_PROMPT,
    prompt: question,
    tools: handle.aiTools,
    stopWhen: stepCountIs(5), // bounded agent loop
  });
  const toolsUsed = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
  return { answer: result.text.trim(), toolsUsed: [...new Set(toolsUsed)] };
}

/* ── Mock orchestration: deterministic intent routing (offline, no key) ── */
const TOPICS = ["technology", "sports", "tech", "ai", "business", "science", "politics", "health"];

// Pull the place name out of "...weather in <City>..." (keeps original casing).
function extractCity(question: string): string {
  const m = question.match(/\b(?:weather|temperature|forecast)\b[^.?!]*?\b(?:in|for|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (m) return m[1];
  const any = question.match(/\b(?:in|for|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  return any ? any[1] : "Berlin";
}

async function mockOrchestrate(question: string, handle: McpHandle): Promise<AgentResult> {
  const q = question.toLowerCase();
  const wantsWeather = /\b(weather|temperature|forecast|hot|cold|rain|sunny|wind)\b/.test(q);
  const wantsNews = /\b(news|headline|headlines|latest|happening|stories)\b/.test(q);

  if (!wantsWeather && !wantsNews) {
    return {
      answer: "I can only help with current weather and the latest news. Try asking about the weather in a city or the latest news on a topic.",
      toolsUsed: [],
    };
  }

  const parts: string[] = [];
  const toolsUsed: string[] = [];

  if (wantsWeather) {
    const r = await handle.callTool("get_weather", { location: extractCity(question) });
    parts.push(r.text);
    toolsUsed.push("get_weather");
  }
  if (wantsNews) {
    const topic = TOPICS.find((t) => q.includes(t)) ?? "technology";
    const r = await handle.callTool("get_news", { topic, limit: 3 });
    parts.push(r.text);
    toolsUsed.push("get_news");
  }
  return { answer: parts.join("\n\n"), toolsUsed };
}
