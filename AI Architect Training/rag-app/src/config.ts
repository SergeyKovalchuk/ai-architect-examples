import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export type Provider = "azure" | "dial" | "mock";

export const config = {
  provider: (process.env.PROVIDER ?? "mock") as Provider,
  topK: Number(process.env.TOP_K ?? 4),
  chunkSize: Number(process.env.CHUNK_SIZE ?? 900),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 150),

  paths: {
    docs: path.join(ROOT, "data", "docs"),
    acl: path.join(ROOT, "data", "acl.json"),
    golden: path.join(ROOT, "data", "golden.json"),
    index: path.join(ROOT, "data", "index.json"),
    evalReport: path.join(ROOT, "data", "eval-report.json"),
    publicDir: path.join(ROOT, "public"),
  },

  azure: {
    resourceName: process.env.AZURE_RESOURCE_NAME ?? "",
    apiKey: process.env.AZURE_API_KEY ?? "",
    chat: process.env.AZURE_CHAT_DEPLOYMENT ?? "gpt-4o-mini",
    embed: process.env.AZURE_EMBED_DEPLOYMENT ?? "text-embedding-3-small",
    vision: process.env.AZURE_VISION_DEPLOYMENT ?? "gpt-4o",
  },

  dial: {
    baseURL: process.env.DIAL_BASE_URL ?? "",
    apiKey: process.env.DIAL_API_KEY ?? "",
    chat: process.env.DIAL_CHAT_MODEL ?? "gpt-4o-mini",
    embed: process.env.DIAL_EMBED_MODEL ?? "text-embedding-3-small-1",
    vision: process.env.DIAL_VISION_MODEL ?? "gpt-4o",
  },
};

export const isMock = config.provider === "mock";
