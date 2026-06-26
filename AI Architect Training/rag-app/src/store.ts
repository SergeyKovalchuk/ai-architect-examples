// File-backed vector store (no external vector DB).
// Supports incremental upsert/remove by document, so the corpus can be
// updated WITHOUT rebuilding the whole index (Ninja challenge #1).
import fs from "node:fs";
import { config } from "./config.js";
import type { Chunk } from "./types.js";

interface IndexFile {
  provider: string;
  createdAt: string;
  chunks: Chunk[];
}

export class VectorStore {
  private chunks: Chunk[] = [];
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    if (fs.existsSync(config.paths.index)) {
      const raw = JSON.parse(fs.readFileSync(config.paths.index, "utf8")) as IndexFile;
      this.chunks = raw.chunks ?? [];
    }
    this.loaded = true;
  }

  save(): void {
    const out: IndexFile = { provider: config.provider, createdAt: new Date().toISOString(), chunks: this.chunks };
    fs.writeFileSync(config.paths.index, JSON.stringify(out));
  }

  /** Has this exact document version already been indexed? (hash match) */
  hasDocVersion(docId: string, contentHash: string): boolean {
    return this.chunks.some((c) => c.docId === docId && c.contentHash === contentHash);
  }

  /** Replace all chunks for a document (incremental update — others untouched). */
  upsertDoc(docId: string, chunks: Chunk[]): void {
    this.removeDoc(docId);
    this.chunks.push(...chunks);
  }

  removeDoc(docId: string): number {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
    return before - this.chunks.length;
  }

  all(): Chunk[] {
    return this.chunks;
  }

  /** Chunks visible to a user given their roles (ACL filter). */
  visibleTo(roles: string[]): Chunk[] {
    return this.chunks.filter((c) => c.allowedRoles.some((r) => roles.includes(r)));
  }

  stats() {
    const docs = new Map<string, number>();
    for (const c of this.chunks) docs.set(c.docId, (docs.get(c.docId) ?? 0) + 1);
    return { totalChunks: this.chunks.length, documents: Object.fromEntries(docs) };
  }
}

export const store = new VectorStore();
