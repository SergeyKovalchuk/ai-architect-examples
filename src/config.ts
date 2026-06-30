import "dotenv/config";

export type Provider = "azure" | "dial" | "mock";

export const config = {
  provider: (process.env.PROVIDER ?? "mock") as Provider,
  offline: process.env.OFFLINE !== "0", // default ON: no network/keys needed
  topK: Number(process.env.TOP_K ?? 4),
  azure: {
    resourceName: process.env.AZURE_RESOURCE_NAME ?? "",
    apiKey: process.env.AZURE_API_KEY ?? "",
    chat: process.env.AZURE_CHAT_DEPLOYMENT ?? "gpt-4o-mini",
    embed: process.env.AZURE_EMBED_DEPLOYMENT ?? "text-embedding-3-small",
  },
  dial: {
    baseURL: process.env.DIAL_BASE_URL ?? "",
    apiKey: process.env.DIAL_API_KEY ?? "",
    apiVersion: process.env.DIAL_API_VERSION ?? "2024-02-15-preview",
    chat: process.env.DIAL_CHAT_MODEL ?? "gpt-4o-mini",
    embed: process.env.DIAL_EMBED_MODEL ?? "text-embedding-3-small-1",
  },
  // Abuse / cost controls (LLM10 unbounded consumption).
  limits: {
    ratePerMinute: Number(process.env.RATE_PER_MIN ?? 30),     // requests/min per token-or-IP
    maxQuestionChars: Number(process.env.MAX_QUESTION_CHARS ?? 1000),
    bodyLimitBytes: Number(process.env.BODY_LIMIT_BYTES ?? 32 * 1024),
    maxSteps: Number(process.env.MAX_STEPS ?? 6),              // bounded agent loop
    maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS ?? 800),
    // Cross-origin allowlist; empty = same-origin only (locked down).
    corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  },
};

export const isMock = config.provider === "mock";

/** Reject empty or oversized questions before any model/tool work (LLM10). */
export function questionWithinLimit(q: string): boolean {
  const t = (q ?? "").trim();
  return t.length > 0 && t.length <= config.limits.maxQuestionChars;
}
