import "dotenv/config";

export type Provider = "azure" | "dial" | "mock";

export const config = {
  provider: (process.env.PROVIDER ?? "mock") as Provider,
  offline: process.env.OFFLINE === "1",
  azure: {
    resourceName: process.env.AZURE_RESOURCE_NAME ?? "",
    apiKey: process.env.AZURE_API_KEY ?? "",
    chat: process.env.AZURE_CHAT_DEPLOYMENT ?? "gpt-4o-mini",
  },
  dial: {
    baseURL: process.env.DIAL_BASE_URL ?? "",
    apiKey: process.env.DIAL_API_KEY ?? "",
    chat: process.env.DIAL_CHAT_MODEL ?? "gpt-4o-mini",
  },
};

export const isMock = config.provider === "mock";
