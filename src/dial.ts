// OpenAI-compatible gateways with Azure-style deployment URLs (e.g. DIAL) use:
// POST {DIAL_BASE_URL}/openai/deployments/{model}/chat/completions
// The AI SDK appends /chat/completions (or /embeddings) to baseURL per model.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { config } from "./config.js";

export function dialClient(deployment: string) {
  const root = config.dial.baseURL.replace(/\/$/, "");
  return createOpenAICompatible({
    name: "dial",
    baseURL: `${root}/openai/deployments/${deployment}`,
    headers: { "api-key": config.dial.apiKey },
    queryParams: { "api-version": config.dial.apiVersion },
  });
}
