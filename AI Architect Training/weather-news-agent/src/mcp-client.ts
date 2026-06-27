// Bridge: spawn the two MCP servers over stdio, connect official MCP clients,
// and expose their tools both as Vercel AI SDK tools (for the LLM orchestrator)
// and as a raw callTool() (for the offline mock router).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool, jsonSchema, type ToolSet } from "ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Server {
  label: string;
  file: string;
}
const SERVERS: Server[] = [
  { label: "weather", file: path.join(__dirname, "mcp", "weather-server.ts") },
  { label: "news", file: path.join(__dirname, "mcp", "news-server.ts") },
];

export interface McpHandle {
  aiTools: ToolSet; // tools for the AI SDK orchestrator
  toolNames: string[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ text: string; structured: any }>;
  close: () => Promise<void>;
}

export async function startMcp(): Promise<McpHandle> {
  const clients: Client[] = [];
  const ownerOf = new Map<string, Client>();
  const aiTools: ToolSet = {};

  for (const s of SERVERS) {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", s.file],
      env: { ...process.env } as Record<string, string>,
    });
    const client = new Client({ name: `${s.label}-client`, version: "1.0.0" });
    await client.connect(transport);
    clients.push(client);

    const { tools } = await client.listTools();
    for (const t of tools) {
      ownerOf.set(t.name, client);
      aiTools[t.name] = tool({
        description: t.description ?? "",
        inputSchema: jsonSchema(t.inputSchema as any),
        execute: async (args) => (await callTool(t.name, args as Record<string, unknown>)).text,
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

  return {
    aiTools,
    toolNames: [...ownerOf.keys()],
    callTool,
    close: async () => { for (const c of clients) await c.close(); },
  };
}
