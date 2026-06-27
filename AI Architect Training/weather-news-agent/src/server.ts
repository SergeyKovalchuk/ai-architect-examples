// Lightweight web server: serves the UI and a single /api/ask endpoint.
// One MCP connection is started at boot and reused across requests.
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fstatic from "@fastify/static";
import { config } from "./config.js";
import { startMcp, type McpHandle } from "./mcp-client.js";
import { ask } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mcp: McpHandle = await startMcp(); // shared connection to both MCP servers

const app = Fastify({ logger: false });
await app.register(fstatic, { root: path.join(__dirname, "..", "public") });

app.get("/api/health", async () => ({
  ok: true,
  provider: config.provider,
  offline: config.offline,
  tools: mcp.toolNames,
}));

app.post("/api/ask", async (req: any, reply) => {
  const question = (req.body?.question ?? "").toString().trim();
  if (!question) return reply.code(400).send({ error: "question required" });
  const res = await ask(question, mcp);
  return { question, ...res };
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Weather & News Agent → http://localhost:${port}  [provider=${config.provider} offline=${config.offline}]`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { await mcp.close(); await app.close(); process.exit(0); });
}
