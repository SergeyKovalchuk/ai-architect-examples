import { describe, it, expect } from "vitest";
import { config, questionWithinLimit } from "../src/config.js";

describe("request limits (LLM10 abuse / cost controls)", () => {
  it("rejects empty questions", () => {
    expect(questionWithinLimit("")).toBe(false);
    expect(questionWithinLimit("   ")).toBe(false);
  });

  it("accepts a normal question", () => {
    expect(questionWithinLimit("head-to-head Nadal vs Federer")).toBe(true);
  });

  it("rejects an oversized question", () => {
    expect(questionWithinLimit("x".repeat(config.limits.maxQuestionChars + 1))).toBe(false);
  });

  it("exposes sane default budgets", () => {
    expect(config.limits.maxSteps).toBeGreaterThan(0);
    expect(config.limits.maxOutputTokens).toBeGreaterThan(0);
    expect(config.limits.ratePerMinute).toBeGreaterThan(0);
  });
});
