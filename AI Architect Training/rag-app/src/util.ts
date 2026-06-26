import crypto from "node:crypto";

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "by", "with", "at", "as", "it", "its", "be", "this", "that",
  "from", "did", "do", "what", "how", "much", "many", "which", "when", "who",
  "their", "they", "we", "our", "you", "your",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9$.%,]+/g) ?? [])
    .map((t) => t.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((t) => t.length > 0);
}

export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOP.has(t) && t.length > 1);
}

export function splitSentences(text: string): string[] {
  // Treat line breaks (from PDF layout) as boundaries first, then split each
  // line on sentence punctuation. This keeps headers, table rows, and facts
  // as separate units instead of merging them into one run-on "sentence".
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const t = line.replace(/[ \t]+/g, " ").trim();
    if (!t) continue;
    for (const part of t.split(/(?<=[.!?])\s+(?=[A-Z(0-9])/)) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
