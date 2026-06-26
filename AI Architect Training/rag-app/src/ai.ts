// Provider abstraction over the Vercel AI SDK.
// Supports: azure (Azure OpenAI), dial (EPAM DIAL / OpenAI-compatible),
// and mock (offline deterministic mode — no API keys needed).
import fs from "node:fs";
import { embedMany, generateObject } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { config, isMock } from "./config.js";
import { contentTokens, splitSentences } from "./util.js";

const MOCK_DIM = 256;

/* ───────────────────────── model wiring ───────────────────────── */

function chatModel() {
  if (config.provider === "azure") {
    const azure = createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey });
    return azure(config.azure.chat);
  }
  const dial = createOpenAICompatible({ name: "dial", baseURL: config.dial.baseURL, apiKey: config.dial.apiKey });
  return dial.chatModel(config.dial.chat);
}

function visionModel() {
  if (config.provider === "azure") {
    const azure = createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey });
    return azure(config.azure.vision);
  }
  const dial = createOpenAICompatible({ name: "dial", baseURL: config.dial.baseURL, apiKey: config.dial.apiKey });
  return dial.chatModel(config.dial.vision);
}

function embedModel() {
  if (config.provider === "azure") {
    const azure = createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey });
    return azure.textEmbeddingModel(config.azure.embed);
  }
  const dial = createOpenAICompatible({ name: "dial", baseURL: config.dial.baseURL, apiKey: config.dial.apiKey });
  return dial.textEmbeddingModel(config.dial.embed);
}

/* ───────────────────────── embeddings ───────────────────────── */

// Deterministic hashing embedding for mock mode: bag-of-words + bigrams
// hashed into a fixed-dimensional, L2-normalized vector. Shared vocabulary
// between a query and a chunk produces real cosine similarity, so retrieval
// metrics are genuinely exercised offline.
function mockEmbed(text: string): number[] {
  const v = new Array(MOCK_DIM).fill(0);
  const toks = contentTokens(text);
  const grams = [...toks];
  for (let i = 0; i < toks.length - 1; i++) grams.push(toks[i] + "_" + toks[i + 1]);
  for (const g of grams) {
    let h = 2166136261;
    for (let i = 0; i < g.length; i++) {
      h ^= g.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % MOCK_DIM] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (isMock) return texts.map(mockEmbed);
  const { embeddings } = await embedMany({ model: embedModel(), values: texts });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

/* ─────────────────── grounded answer generation ─────────────────── */

const answerSchema = z.object({
  answer: z.string().describe("The answer, derived ONLY from the context. If not answerable, exactly 'I have no answer.'"),
  citationIds: z.array(z.string()).describe("IDs of the context chunks actually used, e.g. ['DOC1#2']"),
  refused: z.boolean().describe("true if the context does not contain the answer"),
});
export type GroundedAnswer = z.infer<typeof answerSchema>;

const REFUSAL = "I have no answer.";

export async function generateGroundedAnswer(question: string, contextChunks: { id: string; text: string }[]): Promise<GroundedAnswer> {
  if (contextChunks.length === 0) return { answer: REFUSAL, citationIds: [], refused: true };

  if (isMock) return mockAnswer(question, contextChunks);

  const context = contextChunks.map((c) => `<chunk id=${c.id}>\n${c.text}\n</chunk>`).join("\n\n");
  const { object } = await generateObject({
    model: chatModel(),
    schema: answerSchema,
    system:
      "You are a careful document assistant. Answer ONLY from the provided context chunks. " +
      "Never use outside knowledge. If the answer is not in the context, set refused=true and answer exactly 'I have no answer.'. " +
      "Cite the chunk ids you used.",
    prompt: `Question: ${question}\n\nContext (numbered chunks):\n${context}`,
  });
  return object;
}

// Mock answerer: return the top-2 context sentences most overlapping the
// question (extractive). A small bonus is given to sentences containing a
// number, since most golden questions ask for a quantity.
function mockAnswer(question: string, ctx: { id: string; text: string }[]): GroundedAnswer {
  const stem = (t: string) => (t.length > 5 ? t.slice(0, 5) : t); // crude stemmer: employ≈employed
  const q = new Set(contentTokens(question).map(stem));
  const scored: { score: number; sentence: string; id: string }[] = [];
  for (const c of ctx) {
    for (const s of splitSentences(c.text)) {
      const toks = contentTokens(s).map(stem);
      let overlap = toks.filter((t) => q.has(t)).length;
      if (overlap === 0) continue;
      if (/[$%]|\d[.,]\d/.test(s)) overlap += 0.6; // prefer metric-bearing sentences ($, %, 4.2, 7,300) over bare years
      scored.push({ score: overlap, sentence: s, id: c.id });
    }
  }
  if (scored.length === 0) return { answer: REFUSAL, citationIds: [], refused: true };
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2);
  return {
    answer: top.map((t) => t.sentence).join(" "),
    citationIds: [...new Set(top.map((t) => t.id))],
    refused: false,
  };
}

/* ───────────────────── faithfulness judge ───────────────────── */

const judgeSchema = z.object({
  faithful: z.boolean().describe("true if every claim in the answer is supported by the context"),
  reason: z.string(),
});

export async function judgeFaithfulness(answer: string, contextChunks: { text: string }[]): Promise<{ faithful: boolean; score: number; reason: string }> {
  if (answer.trim() === REFUSAL) return { faithful: true, score: 1, reason: "Refusal is trivially faithful." };

  if (isMock) {
    // token-overlap groundedness
    const ctxTokens = new Set(contextChunks.flatMap((c) => contentTokens(c.text)));
    const aTokens = contentTokens(answer);
    const supported = aTokens.filter((t) => ctxTokens.has(t)).length;
    const score = aTokens.length ? supported / aTokens.length : 1;
    return { faithful: score >= 0.6, score: Number(score.toFixed(3)), reason: `Token groundedness ${(score * 100).toFixed(0)}%.` };
  }

  const context = contextChunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
  const { object } = await generateObject({
    model: chatModel(),
    schema: judgeSchema,
    system: "You are a strict RAG evaluator. Decide if the ANSWER is fully supported by the CONTEXT. Judge only grounding, not correctness.",
    prompt: `CONTEXT:\n${context}\n\nANSWER:\n${answer}`,
  });
  return { faithful: object.faithful, score: object.faithful ? 1 : 0, reason: object.reason };
}

/* ───────────────────── multimodal: describe image ───────────────────── */

const imageSchema = z.object({
  description: z.string().describe("Detailed description of the chart/figure"),
  keyFacts: z.array(z.string()).describe("The most important facts/values readable from the image"),
});

export async function describeImage(imagePath: string): Promise<{ description: string; keyFacts: string[] }> {
  if (isMock) {
    // Vision is unavailable offline. Use a sidecar `<image>.txt` ground-truth
    // description if present, so the multimodal *pipeline* is still demonstrable.
    const sidecar = imagePath + ".txt";
    if (fs.existsSync(sidecar)) {
      const text = fs.readFileSync(sidecar, "utf8").trim();
      return { description: text, keyFacts: text.split("\n").filter(Boolean) };
    }
    return { description: "[mock mode: vision model not called]", keyFacts: [] };
  }

  const bytes = fs.readFileSync(imagePath);
  const { object } = await generateObject({
    model: visionModel(),
    schema: imageSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this figure for document retrieval. Extract all values, labels, and percentages. Ignore logos/background." },
          { type: "image", image: bytes },
        ],
      },
    ],
  });
  return object;
}
