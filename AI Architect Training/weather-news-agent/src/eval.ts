// Evaluation harness over a small golden dataset. Three metrics:
//   1. Tool-selection accuracy — did the agent call exactly the right MCP tools?
//   2. Answer correctness      — expected facts present in the answer.
//   3. Safety (scope) rate     — out-of-scope questions are declined (no tool calls).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { ask } from "./agent.js";
import { startMcp } from "./mcp-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "golden.json"), "utf8"));

const eqSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const mcp = await startMcp(); // reuse one MCP connection for all questions
const rows: any[] = [];
let toolOK = 0, ansOK = 0, scopeOK = 0;
const inScope = golden.questions.filter((q: any) => q.inScope);
const outScope = golden.questions.filter((q: any) => !q.inScope);

for (const q of golden.questions) {
  const { answer, toolsUsed } = await ask(q.query, mcp);
  const toolMatch = eqSet(toolsUsed, q.expectedTools);
  const lc = answer.toLowerCase();
  const contentMatch = q.expectedContains.every((k: string) => lc.includes(k.toLowerCase()));
  if (toolMatch) toolOK++;
  if (contentMatch) ansOK++;
  if (!q.inScope && toolsUsed.length === 0) scopeOK++;
  rows.push({ id: q.id, inScope: q.inScope, expectedTools: q.expectedTools, toolsUsed, toolMatch, contentMatch, answer });
}
await mcp.close();

const report = {
  provider: config.provider,
  offline: config.offline,
  generatedAt: new Date().toISOString(),
  metrics: {
    toolSelectionAccuracy: toolOK / golden.questions.length,
    answerCorrectness: ansOK / golden.questions.length,
    safetyScopeRate: outScope.length ? scopeOK / outScope.length : 1,
  },
  counts: { total: golden.questions.length, inScope: inScope.length, outScope: outScope.length },
  perQuestion: rows,
};
fs.writeFileSync(path.join(__dirname, "..", "data", "eval-report.json"), JSON.stringify(report, null, 2));

const m = report.metrics;
console.log(`\n=== AGENT EVALUATION (provider=${report.provider}, offline=${report.offline}) ===`);
console.log(`Questions: ${report.counts.total} (in-scope ${report.counts.inScope}, out-of-scope ${report.counts.outScope})`);
console.log(`Tool-selection accuracy : ${pct(m.toolSelectionAccuracy)}`);
console.log(`Answer correctness      : ${pct(m.answerCorrectness)}`);
console.log(`Safety (scope) rate     : ${pct(m.safetyScopeRate)}`);
console.log(`\nPer-question:`);
for (const r of rows) console.log(`  ${r.id} ${r.toolMatch ? "✓" : "✗"}tool ${r.contentMatch ? "✓" : "✗"}content  tools=[${r.toolsUsed.join(",")}]`);
console.log(`\nReport: data/eval-report.json`);
process.exit(0);
