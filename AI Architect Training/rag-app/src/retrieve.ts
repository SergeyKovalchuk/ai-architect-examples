// ACL-aware retrieval (Ninja challenge #2): only chunks whose allowedRoles
// intersect the user's roles are even considered as candidates.
import { config } from "./config.js";
import { embedQuery } from "./ai.js";
import { cosine } from "./util.js";
import { store } from "./store.js";
import type { RetrievedChunk, User } from "./types.js";

export async function retrieve(query: string, user: User, topK = config.topK): Promise<RetrievedChunk[]> {
  store.load();
  const candidates = store.visibleTo(user.roles); // ← access control happens BEFORE scoring
  if (candidates.length === 0) return [];
  const qv = await embedQuery(query);
  return candidates
    .map((c) => ({ ...c, score: cosine(qv, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
