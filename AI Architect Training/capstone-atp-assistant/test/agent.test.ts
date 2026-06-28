import { describe, it, expect } from "vitest";
import { route, trimHistory, type ChatMessage } from "../src/agent.js";

const tools = (q: string) => route(q).map((i) => i.tool).sort();

describe("agent intent routing (mock orchestrator)", () => {
  it("routes a rules question to the case-note RAG", () => {
    expect(route("Can I challenge a line call on clay?")[0].tool).toBe("search_case_notes");
  });

  it("routes a head-to-head question to the ATP data tool", () => {
    const i = route("What is the head-to-head between Nadal and Djokovic?");
    expect(i[0].tool).toBe("head_to_head");
    expect(i[0]).toMatchObject({ player1: "Rafael Nadal", player2: "Novak Djokovic" });
  });

  it("routes a single-player record question to player_summary", () => {
    const i = route("What is Roger Federer's record and titles?");
    expect(i[0]).toMatchObject({ tool: "player_summary", player: "Roger Federer" });
  });

  it("routes a weather question and extracts the city", () => {
    const i = route("What's the weather in Paris?");
    expect(i[0]).toMatchObject({ tool: "get_weather", location: "Paris" });
  });

  it("routes a news question", () => {
    expect(route("Give me the latest tennis news")[0].tool).toBe("get_news");
  });

  it("routes a surface/year match search to query_matches", () => {
    const i = route("Show me Clay matches from 2012");
    expect(i[0]).toMatchObject({ tool: "query_matches", surface: "Clay", year: 2012 });
  });

  it("handles a COMBINED question (weather + head-to-head)", () => {
    const t = tools("Weather in Paris and the head-to-head of Nadal vs Federer");
    expect(t).toEqual(["get_weather", "head_to_head"]);
  });

  it("handles a 4-way combined question (rules + weather + news + head-to-head)", () => {
    const t = tools("Head-to-head Nadal vs Federer, weather in Paris, latest tennis news, and can I challenge a line call on clay?");
    expect(t).toEqual(["get_news", "get_weather", "head_to_head", "search_case_notes"]);
  });

  it("does NOT fire query_matches for a rules question that mentions a surface", () => {
    // "on clay" must not be mistaken for a data search in a rules question.
    expect(tools("Can I challenge a line call on clay?")).toEqual(["search_case_notes"]);
  });

  it("declines an out-of-scope question (no intents)", () => {
    expect(route("Write me a poem about my cat")).toEqual([]);
  });
});

describe("rolling-window history (trimHistory)", () => {
  const mk = (n: number, len = 10): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: "x".repeat(len) }));

  it("keeps short histories unchanged", () => {
    const h = mk(4);
    expect(trimHistory(h)).toHaveLength(4);
  });

  it("caps to the last 12 turns", () => {
    expect(trimHistory(mk(30))).toHaveLength(12);
  });

  it("trims by character budget, keeping the most recent turns", () => {
    const h = mk(12, 2000); // 12 * 2000 = 24000 chars, well over the 6000 budget
    const kept = trimHistory(h);
    expect(kept.length).toBeLessThan(12);
    expect(kept.length).toBeGreaterThanOrEqual(2);
    expect(kept.reduce((s, m) => s + m.content.length, 0)).toBeLessThanOrEqual(6000);
  });
});
