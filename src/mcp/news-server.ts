// MCP server: latest news (Google News RSS, no key). See ../news.ts for logic.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "../config.js";
import { getNews, formatNews } from "../news.js";

const server = new McpServer({ name: "news-mcp", version: "1.0.0" });

server.registerTool(
  "get_news",
  {
    title: "Get latest news",
    description: "Latest news headlines for a topic or query (e.g. 'tennis', a player or tournament).",
    inputSchema: {
      topic: z.string().describe("News topic or search query"),
      limit: z.number().int().min(1).max(10).default(3),
    },
  },
  async ({ topic, limit }) => {
    const items = await getNews(topic, limit);
    return {
      content: [{ type: "text", text: formatNews(topic, items) }],
      structuredContent: { topic, count: items.length, headlines: items, source: config.offline ? "offline-sample" : "google-news-rss" },
    };
  },
);

await server.connect(new StdioServerTransport());
