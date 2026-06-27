import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { config } from "./config.js";

export function chatModel() {
  if (config.provider === "azure") {
    return createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey })(config.azure.chat);
  }
  return createOpenAICompatible({ name: "dial", baseURL: config.dial.baseURL, apiKey: config.dial.apiKey }).chatModel(config.dial.chat);
}

export const SYSTEM_PROMPT =
  "You are a helpful assistant that ONLY answers questions about current weather and the latest news. " +
  "Use the get_weather tool for weather and the get_news tool for news. " +
  "If a question is outside weather or news, politely decline and say what you can help with. " +
  "Base your answer only on tool results; do not invent data. Be concise.";
