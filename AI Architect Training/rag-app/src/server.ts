// Lightweight Node API + static frontend.
import Fastify from "fastify";
import fstatic from "@fastify/static";
import fs from "node:fs";
import { config } from "./config.js";
import { ingestAll } from "./ingest.js";
import { answerQuestion } from "./rag.js";
import { extractViz } from "./extract.js";
import { runEval } from "./eval.js";
import { store } from "./store.js";

const GOLDEN = JSON.parse(fs.readFileSync(config.paths.golden, "utf8"));
const ROLE_PRESETS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GOLDEN.users).map(([k, v]: any) => [k, v.roles]),
);

function rolesFor(user?: string, roles?: string[]): string[] {
  if (roles && roles.length) return roles;
  return ROLE_PRESETS[user ?? "guest"] ?? ["public"];
}

const app = Fastify({ logger: false });
await app.register(fstatic, { root: config.paths.publicDir });

app.get("/api/health", async () => {
  store.load();
  return { ok: true, provider: config.provider, stats: store.stats() };
});

app.get("/api/users", async () => ({ presets: ROLE_PRESETS }));

app.post("/api/ingest", async (req: any) => {
  const r = await ingestAll(Boolean(req.body?.force));
  return { ...r, stats: store.stats() };
});

app.post("/api/query", async (req: any) => {
  const { query, user, roles } = req.body ?? {};
  if (!query) return { error: "query required" };
  const res = await answerQuestion(query, { roles: rolesFor(user, roles) });
  return {
    answer: res.answer,
    refused: res.refused,
    citations: res.citations,
    retrieved: res.retrieved.map((r) => ({ id: r.id, docId: r.docId, title: r.title, modality: r.modality, score: Number(r.score.toFixed(3)) })),
  };
});

app.post("/api/visualize", async (req: any) => {
  const { user, roles } = req.body ?? {};
  return extractViz({ roles: rolesFor(user, roles) });
});

app.post("/api/eval", async () => runEval());

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`RAG app on http://localhost:${port}  (provider: ${config.provider})`);
});
