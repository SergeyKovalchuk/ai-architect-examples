// RAG over the "problematic match / supervisor-call" case-note corpus.
// Ingest markdown cases -> chunk -> embed -> retrieve top-k with citations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { embedTexts, embedQuery, cosine } from "./embeddings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.join(__dirname, "..", "data", "cases");

export interface CaseDoc { caseId: string; title: string; tags: string[]; roles: string[]; body: string; }
export interface Chunk { caseId: string; title: string; text: string; roles: string[]; embedding: number[]; }
export interface Retrieved { caseId: string; title: string; score: number; text: string; }

// Tiny frontmatter parser (no dependency).
function parseCase(file: string, raw: string): CaseDoc {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = m ? m[1] : "";
  const body = (m ? m[2] : raw).trim();
  const get = (k: string) => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1] ?? "").trim();
  const list = (k: string) => {
    const v = get(k).replace(/^\[|\]$/g, "");
    return v ? v.split(",").map((t) => t.trim()).filter(Boolean) : [];
  };
  const roles = list("roles");
  return {
    caseId: get("id") || path.basename(file, ".md"),
    title: get("title") || path.basename(file, ".md"),
    tags: list("tags"),
    roles: roles.length ? roles : ["public"], // default: public
    body,
  };
}

export function loadCorpus(dir: string = CASES_DIR): CaseDoc[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
    .map((f) => parseCase(f, fs.readFileSync(path.join(dir, f), "utf8")));
}

// Sentence-aware chunking (keeps cases small => mostly one chunk each).
function chunkBody(text: string, size = 600): string[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length > size && buf) { chunks.push(buf.trim()); buf = ""; }
    buf += s + " ";
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

let _index: Chunk[] | null = null;

export async function buildIndex(dir: string = CASES_DIR): Promise<Chunk[]> {
  if (_index) return _index;
  const docs = loadCorpus(dir);
  const pending: { caseId: string; title: string; roles: string[]; text: string }[] = [];
  for (const d of docs) {
    // Prepend title+tags so retrieval can match on them too.
    for (const c of chunkBody(d.body)) {
      pending.push({ caseId: d.caseId, title: d.title, roles: d.roles, text: `${d.title}. ${d.tags.join(", ")}. ${c}` });
    }
  }
  const vectors = await embedTexts(pending.map((p) => p.text));
  _index = pending.map((p, i) => ({ ...p, embedding: vectors[i] }));
  return _index;
}

export function resetIndex() { _index = null; }

const DEFAULT_ROLES = ["public"];

/**
 * ACL-aware retrieval: a chunk is only a candidate if the user's roles intersect
 * the chunk's allowed roles. Access control happens BEFORE scoring (LLM08/RAG).
 */
export async function retrieve(query: string, k: number = config.topK, roles: string[] = DEFAULT_ROLES): Promise<Retrieved[]> {
  const index = await buildIndex();
  const qv = await embedQuery(query);
  return index
    .filter((c) => c.roles.some((r) => roles.includes(r)))
    .map((c) => ({ caseId: c.caseId, title: c.title, text: c.text, score: cosine(qv, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Build a numbered context + citation list for the agent / answer layer. */
export async function ragContext(query: string, k: number = config.topK, roles: string[] = DEFAULT_ROLES) {
  const hits = await retrieve(query, k, roles);
  const context = hits.map((h, i) => `[${i + 1}] (${h.caseId}) ${h.text}`).join("\n\n");
  const citations = hits.map((h, i) => ({ n: i + 1, caseId: h.caseId, title: h.title }));
  return { context, citations, hits };
}
