// Ingestion pipeline: PDF/image → text/description → chunk → embed → store.
// Incremental: a document whose content hash is already indexed is skipped,
// so updating the corpus does NOT rebuild the whole index (Ninja #1).
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { sha256 } from "./util.js";
import { extractPdf } from "./pdf.js";
import { chunkText } from "./chunk.js";
import { embedTexts, describeImage } from "./ai.js";
import { store } from "./store.js";
import type { Chunk } from "./types.js";

type Acl = Record<string, { title: string; allowedRoles: string[] }>;

function loadAcl(): Acl {
  return JSON.parse(fs.readFileSync(config.paths.acl, "utf8"));
}

async function buildChunksForDoc(docId: string, filePath: string, acl: Acl): Promise<Chunk[]> {
  const bytes = fs.readFileSync(filePath);
  const contentHash = sha256(bytes.toString("base64"));
  const meta = acl[docId] ?? { title: docId, allowedRoles: ["public"] };
  const ext = path.extname(docId).toLowerCase();

  let pieces: { text: string; modality: "text" | "image" }[] = [];

  if (ext === ".pdf") {
    const pages = await extractPdf(new Uint8Array(bytes));
    const full = pages.map((p) => p.text).join("\n");
    pieces = chunkText(full).map((t) => ({ text: t, modality: "text" as const }));
  } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    // Multi-modal (Ninja #3): turn graphical content into searchable text.
    const { description, keyFacts } = await describeImage(filePath);
    const composed = `${meta.title} (figure).\n${description}\nKey facts: ${keyFacts.join("; ")}`;
    pieces = chunkText(composed).map((t) => ({ text: t, modality: "image" as const }));
  } else {
    return [];
  }

  const embeddings = await embedTexts(pieces.map((p) => p.text));
  return pieces.map((p, i) => ({
    id: `${docId}#${i}`,
    docId,
    title: meta.title,
    index: i,
    text: p.text,
    allowedRoles: meta.allowedRoles,
    modality: p.modality,
    embedding: embeddings[i],
    contentHash,
  }));
}

export async function ingestAll(force = false): Promise<{ indexed: string[]; skipped: string[] }> {
  store.load();
  const acl = loadAcl();
  const files = fs.readdirSync(config.paths.docs).filter((f) => !f.endsWith(".txt"));
  const indexed: string[] = [];
  const skipped: string[] = [];

  for (const docId of files) {
    const filePath = path.join(config.paths.docs, docId);
    const hash = sha256(fs.readFileSync(filePath).toString("base64"));
    if (!force && store.hasDocVersion(docId, hash)) {
      skipped.push(docId);
      continue;
    }
    const chunks = await buildChunksForDoc(docId, filePath, acl);
    store.upsertDoc(docId, chunks);
    indexed.push(docId);
  }

  store.save();
  return { indexed, skipped };
}

// CLI entry
const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const force = process.argv.includes("--force");
  ingestAll(force).then((r) => {
    console.log(`Provider: ${config.provider}`);
    console.log(`Indexed: ${r.indexed.join(", ") || "(none)"}`);
    console.log(`Skipped (unchanged): ${r.skipped.join(", ") || "(none)"}`);
    console.log("Store stats:", JSON.stringify(store.stats(), null, 2));
  });
}
