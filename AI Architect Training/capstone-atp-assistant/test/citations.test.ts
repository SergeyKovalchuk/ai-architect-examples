import { describe, it, expect } from "vitest";
import { enforceCitations } from "../src/agent.js";

describe("enforceCitations (structured output — no fabricated sources)", () => {
  const allowed = new Set(["line-call-dispute", "medical-timeout"]);

  it("keeps only citations that were actually retrieved", () => {
    expect(enforceCitations(["line-call-dispute", "made-up-note"], allowed))
      .toEqual(["line-call-dispute"]);
  });

  it("drops all fabricated citations", () => {
    expect(enforceCitations(["ghost-1", "ghost-2"], allowed)).toEqual(["line-call-dispute", "medical-timeout"]);
  });

  it("falls back to the real sources when the model cited none", () => {
    expect(enforceCitations([], allowed).sort()).toEqual(["line-call-dispute", "medical-timeout"]);
  });

  it("returns no citations when nothing was retrieved", () => {
    expect(enforceCitations(["anything"], new Set())).toEqual([]);
  });

  it("de-duplicates citations", () => {
    expect(enforceCitations(["line-call-dispute", "line-call-dispute"], allowed)).toEqual(["line-call-dispute"]);
  });
});
