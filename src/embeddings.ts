// Embeddings + similarity. Offline = deterministic hashing embeddings (no key,
// no network) so retrieval and its tests run anywhere. Live = Azure / OpenAI-compatible gateway.
import { config } from "./config.js";

const DIM = 2048; // larger dim => fewer hash collisions => cleaner offline retrieval
const STOP = new Set([
  "the","a","an","of","to","in","on","for","and","or","is","are","was","were",
  "by","with","at","as","it","its","be","this","that","from","do","does","did",
  "what","how","much","many","which","when","who","can","i","my","you","your","if",
]);

export function contentTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

// Bag-of-words + bigrams hashed into a fixed, L2-normalized vector.
function mockEmbed(text: string): number[] {
  const v = new Array(DIM).fill(0);
  const toks = contentTokens(text);
  const grams = [...toks];
  for (let i = 0; i < toks.length - 1; i++) grams.push(toks[i] + "_" + toks[i + 1]);
  for (const g of grams) {
    let h = 2166136261;
    for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[Math.abs(h) % DIM] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (config.offline || config.provider === "mock") return texts.map(mockEmbed);
  const { embedMany } = await import("ai");
  const { createAzure } = await import("@ai-sdk/azure");
  const { dialClient } = await import("./dial.js");
  const model = config.provider === "azure"
    ? createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey }).textEmbeddingModel(config.azure.embed)
    : dialClient(config.dial.embed).textEmbeddingModel(config.dial.embed);
  const { embeddings } = await embedMany({ model, values: texts });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
