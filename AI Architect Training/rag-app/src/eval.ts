// Evaluation harness over a small golden dataset. Reports four metrics:
//   1. Retrieval Precision@k & Recall@k  (are the right documents retrieved?)
//   2. Answer correctness                (expected keywords present in answer)
//   3. Faithfulness / groundedness       (is the answer supported by context?)
//   4. ACL safety                        (does a guest leak restricted answers?)
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { retrieve } from "./retrieve.js";
import { answerQuestion } from "./rag.js";
import { judgeFaithfulness } from "./ai.js";
import { store } from "./store.js";

interface GoldenQ {
  id: string;
  query: string;
  expectedAnswerContains: string[];
  relevantDocs: string[];
  minRole: string;
}
interface Golden {
  users: Record<string, { roles: string[] }>;
  questions: GoldenQ[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export async function runEval() {
  store.load();
  const golden: Golden = JSON.parse(fs.readFileSync(config.paths.golden, "utf8"));
  const power = golden.users["ceo"].roles; // a user authorized for every question

  const perQ: any[] = [];
  const precision: number[] = [];
  const recall: number[] = [];
  const correctness: number[] = [];
  const faithfulness: number[] = [];

  for (const q of golden.questions) {
    const retrieved = await retrieve(q.query, { roles: power });
    const retrievedDocs = retrieved.map((r) => r.docId);
    const relevantSet = new Set(q.relevantDocs);

    const hits = retrievedDocs.filter((d) => relevantSet.has(d)).length;
    const p = retrievedDocs.length ? hits / retrievedDocs.length : 0;
    const r = q.relevantDocs.length ? Math.min(1, hits / q.relevantDocs.length) : 0;
    precision.push(p);
    recall.push(r);

    const { answer, citations } = await answerQuestion(q.query, { roles: power });
    const lc = answer.toLowerCase();
    const matched = q.expectedAnswerContains.filter((k) => lc.includes(k.toLowerCase())).length;
    const c = q.expectedAnswerContains.length ? matched / q.expectedAnswerContains.length : 0;
    correctness.push(c);

    const ctx = retrieved.map((x) => ({ text: x.text }));
    const f = await judgeFaithfulness(answer, ctx);
    faithfulness.push(f.score);

    perQ.push({ id: q.id, query: q.query, precision: p, recall: r, correctness: c, faithfulness: f.score, answer, citations: citations.map((x) => x.id) });
  }

  // ── ACL safety: ask each restricted question as a GUEST (public only) ──
  const guestRoles = golden.users["guest"].roles;
  const restricted = golden.questions.filter((q) => q.minRole !== "public");
  const aclResults: any[] = [];
  let aclSafe = 0;
  for (const q of restricted) {
    const { answer, refused, retrieved } = await answerQuestion(q.query, { roles: guestRoles });
    const lc = answer.toLowerCase();
    const leaked = q.expectedAnswerContains.some((k) => lc.includes(k.toLowerCase()));
    const safe = refused || !leaked;
    if (safe) aclSafe++;
    aclResults.push({ id: q.id, minRole: q.minRole, leaked, refused, retrievedDocs: retrieved.map((r) => r.docId), answer });
  }

  const report = {
    provider: config.provider,
    generatedAt: new Date().toISOString(),
    storeStats: store.stats(),
    topK: config.topK,
    metrics: {
      retrievalPrecisionAtK: mean(precision),
      retrievalRecallAtK: mean(recall),
      answerCorrectness: mean(correctness),
      faithfulness: mean(faithfulness),
      aclSafetyRate: restricted.length ? aclSafe / restricted.length : 1,
    },
    perQuestion: perQ,
    aclResults,
  };

  fs.writeFileSync(config.paths.evalReport, JSON.stringify(report, null, 2));
  return report;
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  runEval().then((rep) => {
    const m = rep.metrics;
    console.log(`\n=== RAG EVALUATION (provider: ${rep.provider}, top_k=${rep.topK}) ===`);
    console.log(`Questions: ${rep.perQuestion.length} | Index: ${rep.storeStats.totalChunks} chunks`);
    console.log(`Retrieval Precision@k : ${pct(m.retrievalPrecisionAtK)}`);
    console.log(`Retrieval Recall@k    : ${pct(m.retrievalRecallAtK)}`);
    console.log(`Answer Correctness    : ${pct(m.answerCorrectness)}`);
    console.log(`Faithfulness          : ${pct(m.faithfulness)}`);
    console.log(`ACL Safety Rate       : ${pct(m.aclSafetyRate)}`);
    console.log(`\nReport written to ${path.relative(process.cwd(), config.paths.evalReport)}`);
  });
}
