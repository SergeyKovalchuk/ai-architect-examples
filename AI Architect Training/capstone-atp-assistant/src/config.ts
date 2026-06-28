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
};

export const isMock = config.provider === "mock";
