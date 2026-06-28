import { createAzure } from "@ai-sdk/azure";
import { config } from "./config.js";
import { dialClient } from "./dial.js";

export function chatModel() {
  if (config.provider === "azure") {
    return createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey })(config.azure.chat);
  }
  return dialClient(config.dial.chat).chatModel(config.dial.chat);
}

export const SYSTEM_PROMPT =
  "You are the ATP Match Assistant. You help players and coaches with: (1) ATP match data " +
  "(head-to-head, player records, match search) via the atp tools; (2) current weather at a venue; " +
  "(3) the latest tennis news; and (4) rules & precedents from the case-note knowledge base via " +
  "search_case_notes. Always prefer a tool over your own memory. For rules/precedent answers, cite the " +
  "case ids returned by search_case_notes. If a question is outside tennis/weather/news, politely decline. " +
  "Base every factual claim on tool output; be concise.";
