// RAG exposed as a Vercel AI SDK tool (in-process, not an MCP server), plus a
// plain helper for the offline mock orchestrator.
import { tool } from "ai";
import { z } from "zod";
import { ragContext } from "./rag.js";
import { wrapUntrusted } from "./untrusted.js";

/** Build the RAG tool scoped to a user's roles (ACL-aware retrieval). */
export function makeRagTool(roles: string[]) {
  return {
    search_case_notes: tool({
      description:
        "Search the ATP 'problematic match / supervisor-call' case notes (rules & precedents: line calls, coaching, medical timeouts, code violations, supervisor procedure). Use for any rules/what-am-I-allowed-to-do question.",
      inputSchema: z.object({ query: z.string().describe("The player's rules/precedent question") }),
      execute: async ({ query }) => {
        const { context, citations } = await ragContext(query, 3, roles);
        // Retrieved corpus text is untrusted data (LLM01) — wrap before the model sees it.
        const body = `Relevant case notes:\n${context}\n\nCite these case ids: ${citations.map((c) => c.caseId).join(", ")}`;
        return wrapUntrusted("search_case_notes", body);
      },
    }),
  };
}

/** Offline helper: extractive grounded answer from the top case note(s), ACL-aware. */
export async function ragAnswer(query: string, roles: string[] = ["public"]): Promise<{ text: string; citations: string[] }> {
  const { hits } = await ragContext(query, 3, roles);
  if (!hits.length) return { text: "I couldn't find a relevant case note you're authorized to view.", citations: [] };
  const top = hits[0];
  // Strip the prepended "Title. tags." prefix for a cleaner extract.
  const body = top.text.split(". ").slice(2).join(". ").trim() || top.text;
  return { text: `${body}\n\n(source: ${top.caseId})`, citations: [top.caseId] };
}
