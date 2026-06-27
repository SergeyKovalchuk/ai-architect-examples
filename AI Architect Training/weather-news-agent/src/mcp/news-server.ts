// MCP server: latest news via Google News RSS (no API key required).
// Exposes one tool: get_news(topic, limit).
// Swap to GNews.io / NewsAPI / TheNewsAPI by replacing fetchLive() and adding a key.
// Set OFFLINE=1 to return deterministic canned headlines (no network).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const OFFLINE = process.env.OFFLINE === "1";

const CANNED: Record<string, { title: string; source: string }[]> = {
  technology: [
    { title: "New open-source LLM tops efficiency benchmarks", source: "Tech Daily" },
    { title: "Chipmaker unveils next-gen AI accelerator", source: "Hardware Wire" },
    { title: "Regulators publish draft AI safety guidelines", source: "Policy Post" },
  ],
  sports: [
    { title: "Underdog wins national championship in overtime", source: "Sports Desk" },
    { title: "Star player signs record transfer deal", source: "Match Report" },
  ],
  default: [
    { title: "Markets close higher amid easing inflation", source: "World News" },
    { title: "Summit reaches agreement on climate funding", source: "Global Times" },
  ],
};

async function fetchLive(topic: string, limit: number) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
  const parsed = new XMLParser().parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, limit).map((it: any) => ({
    title: String(it.title ?? "").replace(/ - [^-]+$/, "").trim(),
    source: it.source?.["#text"] ?? it.source ?? "Google News",
  }));
}

function cannedNews(topic: string, limit: number) {
  const key = topic.trim().toLowerCase();
  return (CANNED[key] ?? CANNED.default).slice(0, limit);
}

const server = new McpServer({ name: "news-mcp", version: "1.0.0" });

server.registerTool(
  "get_news",
  {
    title: "Get latest news",
    description: "Get the latest news headlines for a topic or query (e.g. 'technology', 'Berlin').",
    inputSchema: {
      topic: z.string().describe("News topic or search query"),
      limit: z.number().int().min(1).max(10).default(3).describe("How many headlines"),
    },
  },
  async ({ topic, limit }) => {
    const items = OFFLINE ? cannedNews(topic, limit) : await fetchLive(topic, limit);
    const text = items.length
      ? `Latest "${topic}" headlines:\n` + items.map((i, n) => `${n + 1}. ${i.title} (${i.source})`).join("\n")
      : `No headlines found for "${topic}".`;
    return {
      content: [{ type: "text", text }],
      structuredContent: { topic, count: items.length, headlines: items, source: OFFLINE ? "offline-canned" : "google-news-rss" },
    };
  },
);

await server.connect(new StdioServerTransport());
