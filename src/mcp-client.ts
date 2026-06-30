// Spawn the three MCP servers (atp-data, weather, news) over stdio, connect
// clients, and expose their tools as Vercel AI SDK tools + a raw callTool().
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool, jsonSchema, type ToolSet } from "ai";
import { wrapUntrusted } from "./untrusted.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVERS = [
  { label: "atp", file: path.join(__dirname, "mcp", "atp-server.ts") },
  { label: "weather", file: path.join(__dirname, "mcp", "weather-server.ts") },
  { label: "news", file: path.join(__dirname, "mcp", "news-server.ts") },
];

export interface McpHandle {
  aiTools: ToolSet;
  toolNames: string[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ text: string; structured: any }>;
  close: () => Promise<void>;
}

export async function startMcp(): Promise<McpHandle> {
  const clients: Client[] = [];
  const ownerOf = new Map<string, Client>();
  const aiTools: ToolSet = {};

  for (const s of SERVERS) {
    const transport = new StdioClientTransport({ command: "npx", args: ["tsx", s.file], env: { ...process.env } as Record<string, string> });
    const client = new Client({ name: `${s.label}-client`, version: "1.0.0" });
    await client.connect(transport);
    clients.push(client);
    const { tools } = await client.listTools();
    for (const t of tools) {
      ownerOf.set(t.name, client);
      aiTools[t.name] = tool({
        description: t.description ?? "",
        inputSchema: jsonSchema(t.inputSchema as any),
        // Wrap tool output as untrusted data before it reaches the model (LLM01).
        execute: async (args) => wrapUntrusted(t.name, (await callTool(t.name, args as Record<string, unknown>)).text),
      });
    }
  }

  async function callTool(name: string, args: Record<string, unknown>) {
    const client = ownerOf.get(name);
    if (!client) throw new Error(`Unknown tool: ${name}`);
    const res: any = await client.callTool({ name, arguments: args });
    const text = (res.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    return { text, structured: res.structuredContent };
  }

  return { aiTools, toolNames: [...ownerOf.keys()], callTool, close: async () => { for (const c of clients) await c.close(); } };
}
