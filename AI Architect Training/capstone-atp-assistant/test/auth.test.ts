import { describe, it, expect } from "vitest";
import { resolveUser, ANONYMOUS } from "../src/auth.js";

describe("auth — bearer token → user/roles", () => {
  it("rejects a missing or invalid token", () => {
    expect(resolveUser(undefined)).toBeNull();
    expect(resolveUser("Bearer nope")).toBeNull();
  });

  it("resolves dev tokens to the right roles", () => {
    expect(resolveUser("Bearer player-token")?.roles).toEqual(["public"]);
    expect(resolveUser("Bearer official-token")?.roles).toContain("official");
    expect(resolveUser("Bearer admin-token")?.roles).toContain("admin");
  });

  it("accepts a raw token without the Bearer prefix", () => {
    expect(resolveUser("admin-token")?.name).toBe("admin");
  });

  it("anonymous user is public-only", () => {
    expect(ANONYMOUS.roles).toEqual(["public"]);
  });
});
