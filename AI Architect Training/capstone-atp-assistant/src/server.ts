// Web server: serves the chat UI and a single /api/ask endpoint.
// One MCP connection (to all 3 servers) is opened at boot and reused.
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fstatic from "@fastify/static";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config, questionWithinLimit } from "./config.js";
import { startMcp, type McpHandle } from "./mcp-client.js";
import { ask } from "./agent.js";
import { resolveUser, isAuthEnabled, ANONYMOUS } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcp: McpHandle = await startMcp();

const app = Fastify({ logger: false, bodyLimit: config.limits.bodyLimitBytes });

// CORS: empty allowlist = same-origin only (locked down); else allow listed origins.
await app.register(cors, {
  origin: config.limits.corsOrigins.length ? config.limits.corsOrigins : false,
  methods: ["GET", "POST"],
});

// Rate limit per token-or-IP (LLM10 unbounded consumption / cost / DoS).
await app.register(rateLimit, {
  max: config.limits.ratePerMinute,
  timeWindow: "1 minute",
  keyGenerator: (req: any) => (req.headers?.authorization ?? req.ip),
});

await app.register(fstatic, { root: path.join(__dirname, "..", "public") });

app.get("/api/health", async () => ({
  ok: true, provider: config.provider, offline: config.offline,
  tools: [...mcp.toolNames, "search_case_notes"],
}));

app.post("/api/ask", async (req: any, reply) => {
  // AuthN: resolve the user from the bearer token (ACL-aware retrieval depends on roles).
  let user = ANONYMOUS;
  if (isAuthEnabled()) {
    const resolved = resolveUser(req.headers?.authorization);
    if (!resolved) return reply.code(401).send({ error: "unauthorized: provide a valid Bearer token" });
    user = resolved;
  }
  const question = (req.body?.question ?? "").toString().trim();
  if (!questionWithinLimit(question)) {
    return reply.code(400).send({ error: `question must be 1-${config.limits.maxQuestionChars} characters` });
  }
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const res = await ask(question, mcp, history, user);
  return { question, user: { name: user.name, roles: user.roles }, ...res };
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
console.log(`ATP Match Assistant → http://localhost:${port}  [provider=${config.provider} offline=${config.offline}]`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { await mcp.close(); await app.close(); process.exit(0); });
}
