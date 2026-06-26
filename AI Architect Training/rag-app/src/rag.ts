// End-to-end RAG query: retrieve (ACL-aware) → generate grounded answer with citations.
import { retrieve } from "./retrieve.js";
import { generateGroundedAnswer } from "./ai.js";
import type { RagAnswer, User } from "./types.js";

export async function answerQuestion(query: string, user: User): Promise<RagAnswer> {
  const retrieved = await retrieve(query, user);
  const ctx = retrieved.map((r) => ({ id: r.id, text: r.text }));
  const result = await generateGroundedAnswer(query, ctx);

  const used = new Set(result.citationIds);
  const citations = retrieved
    .filter((r) => used.has(r.id))
    .map((r) => ({ id: r.id, docId: r.docId, title: r.title }));

  return { answer: result.answer, citations, retrieved, refused: result.refused };
}
