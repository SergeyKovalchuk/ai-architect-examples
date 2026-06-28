// End-to-end evaluation of the assistant over a golden dataset. Metrics:
//   1. Routing / tool-selection accuracy  (did the agent call the right tool[s]?)
//   2. Answer correctness                 (expected facts present in the answer)
//   3. Citation accuracy                  (RAG answers cite the right case note)
//   4. Safety / scope rate                (out-of-scope questions are declined)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { ask } from "./agent.js";
import { startMcp } from "./mcp-client.js";
import type { User } from "./auth.js";

// Evaluate as an authorized power user so every golden item is reachable.
const EVAL_USER: User = { name: "eval", roles: ["public", "official", "admin"] };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "golden.json"), "utf8"));

const eqSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const mcp = await startMcp();
const rows: any[] = [];
let toolOK = 0, ansOK = 0, citeTotal = 0, citeOK = 0, scopeOK = 0;
const outScope = golden.questions.filter((q: any) => !q.inScope);

for (const q of golden.questions) {
  const { answer, toolsUsed, citations } = await ask(q.query, mcp, [], EVAL_USER);
  const toolMatch = eqSet(toolsUsed, q.expectedTools);
  const lc = answer.toLowerCase();
  const contentMatch = q.expectedContains.every((k: string) => lc.includes(k.toLowerCase()));
  if (toolMatch) toolOK++;
  if (contentMatch) ansOK++;
  if (q.expectedCitation) { citeTotal++; if (citations.includes(q.expectedCitation)) citeOK++; }
  if (!q.inScope && toolsUsed.length === 0) scopeOK++;
  rows.push({ id: q.id, toolMatch, contentMatch, toolsUsed, citations });
}
await mcp.close();

const report = {
  provider: config.provider, offline: config.offline, generatedAt: new Date().toISOString(),
  metrics: {
    routingAccuracy: toolOK / golden.questions.length,
    answerCorrectness: ansOK / golden.questions.length,
    citationAccuracy: citeTotal ? citeOK / citeTotal : 1,
    safetyScopeRate: outScope.length ? scopeOK / outScope.length : 1,
  },
  counts: { total: golden.questions.length, withCitations: citeTotal, outOfScope: outScope.length },
  perQuestion: rows,
};
fs.writeFileSync(path.join(__dirname, "..", "data", "eval-report.json"), JSON.stringify(report, null, 2));

const m = report.metrics;
console.log(`\n=== ASSISTANT EVALUATION (provider=${report.provider}, offline=${report.offline}) ===`);
console.log(`Questions: ${report.counts.total} (with citations ${report.counts.withCitations}, out-of-scope ${report.counts.outOfScope})`);
console.log(`Routing / tool-selection : ${pct(m.routingAccuracy)}`);
console.log(`Answer correctness       : ${pct(m.answerCorrectness)}`);
console.log(`Citation accuracy        : ${pct(m.citationAccuracy)}`);
console.log(`Safety (scope) rate      : ${pct(m.safetyScopeRate)}`);
console.log("\nPer-question (tools=[] means the agent called no tools — correct for out-of-scope):");
for (const r of rows) {
  const cites = r.citations.length ? ` cites=[${r.citations.join(",")}]` : "";
  console.log(`  ${r.id} ${r.toolMatch ? "✓" : "✗"}tool ${r.contentMatch ? "✓" : "✗"}content  tools=[${r.toolsUsed.join(",")}]${cites}`);
}
console.log(`\nReport: data/eval-report.json`);
process.exit(0);
