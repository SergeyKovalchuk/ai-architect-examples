// Recursive character chunking with sentence-aware boundaries and overlap.
import { config } from "./config.js";
import { splitSentences } from "./util.js";

export function chunkText(text: string, size = config.chunkSize, overlap = config.chunkOverlap): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let buf = "";

  for (const s of sentences) {
    if (buf.length + s.length + 1 > size && buf.length > 0) {
      chunks.push(buf.trim());
      // start the next chunk with a trailing overlap of the previous one
      buf = overlap > 0 ? buf.slice(Math.max(0, buf.length - overlap)) + " " : "";
    }
    buf += s + " ";
  }
  if (buf.trim().length > 0) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 0);
}
