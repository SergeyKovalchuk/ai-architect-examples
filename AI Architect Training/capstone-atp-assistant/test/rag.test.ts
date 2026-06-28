import { describe, it, expect, beforeAll } from "vitest";
import { loadCorpus, buildIndex, retrieve, ragContext, resetIndex } from "../src/rag.js";

beforeAll(async () => { resetIndex(); await buildIndex(); });

describe("corpus loading", () => {
  it("loads all case notes with frontmatter", () => {
    const docs = loadCorpus();
    expect(docs.length).toBe(8);
    const byId = Object.fromEntries(docs.map((d) => [d.caseId, d]));
    expect(byId["line-call-dispute"].title).toContain("line call");
    expect(byId["medical-timeout"].tags).toContain("MTO");
  });
});

describe("retrieval (offline embeddings)", () => {
  const cases: [string, string][] = [
    ["Can I challenge a line call with Hawk-Eye on hard court?", "line-call-dispute"],
    ["What happens if my coach signals to me from the box?", "coaching-violation"],
    ["How many medical timeouts am I allowed for an injury?", "medical-timeout"],
    ["How long is the shot clock between points?", "time-violation"],
    ["When is play suspended for extreme heat?", "weather-suspension"],
    ["What is the penalty schedule for smashing a racquet?", "racquet-abuse"],
  ];

  it.each(cases)("retrieves the right case for: %s", async (query, expectedId) => {
    const hits = await retrieve(query, 4);
    expect(hits[0].caseId).toBe(expectedId);
  });

  it("returns up to k results sorted by descending score", async () => {
    const hits = await retrieve("supervisor rules dispute", 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    const scores = hits.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("ragContext", () => {
  it("produces numbered context + matching citations", async () => {
    const { context, citations, hits } = await ragContext("medical timeout abuse", 2);
    expect(citations.length).toBe(hits.length);
    expect(context).toContain("[1]");
    expect(citations[0].n).toBe(1);
    expect(citations[0].caseId).toBe(hits[0].caseId);
  });
});
