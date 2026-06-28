import { describe, it, expect } from "vitest";
import { buildAuditRecord } from "../src/audit.js";

describe("audit record (privacy by default)", () => {
  const rec = buildAuditRecord({
    question: "head-to-head Nadal vs Federer",
    user: "player", roles: ["public"],
    toolsUsed: ["head_to_head"], citations: [],
    refused: false, blocked: false, outputRedacted: false,
    latencyMs: 42, provider: "mock",
  });

  it("does not store the raw question (only length + hash)", () => {
    expect(JSON.stringify(rec)).not.toContain("Nadal");
    expect(rec.questionHash.startsWith("sha256:")).toBe(true);
    expect(rec.questionChars).toBe("head-to-head Nadal vs Federer".length);
  });

  it("captures the audit fields", () => {
    expect(rec.event).toBe("ask");
    expect(rec.user).toBe("player");
    expect(rec.toolsUsed).toEqual(["head_to_head"]);
    expect(rec.latencyMs).toBe(42);
    expect(rec.provider).toBe("mock");
  });

  it("redacts secrets from an error message", () => {
    const r = buildAuditRecord({
      question: "x", user: "u", roles: ["public"], toolsUsed: [], citations: [],
      refused: false, blocked: false, outputRedacted: false, latencyMs: 1, provider: "mock",
      error: "auth failed with key sk-acme-7f3d-PRIVATE",
    });
    expect(r.error).toContain("[REDACTED_KEY]");
    expect(r.error).not.toContain("sk-acme-7f3d-PRIVATE");
  });
});
