// Minimal bearer-token auth → user with roles. Roles drive ACL-aware retrieval.
// Tokens come from AUTH_TOKENS (JSON) or fall back to dev defaults below.
export interface User { name: string; roles: string[] }

export const PUBLIC_ROLE = "public";
export const ANONYMOUS: User = { name: "anonymous", roles: [PUBLIC_ROLE] };

// Dev defaults (override in production via AUTH_TOKENS env, JSON: { "<token>": {name, roles[]} }).
const DEV_TOKENS: Record<string, User> = {
  "player-token": { name: "player", roles: ["public"] },
  "official-token": { name: "official", roles: ["public", "official"] },
  "admin-token": { name: "admin", roles: ["public", "official", "admin"] },
};

function loadTokens(): Record<string, User> {
  const raw = process.env.AUTH_TOKENS;
  if (!raw) return DEV_TOKENS;
  try {
    const parsed = JSON.parse(raw) as Record<string, User>;
    return Object.keys(parsed).length ? parsed : DEV_TOKENS;
  } catch {
    return DEV_TOKENS;
  }
}

const TOKENS = loadTokens();

/** Resolve a user from an Authorization header ("Bearer <token>") or raw token. */
export function resolveUser(authHeader?: string | null): User | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return TOKENS[token] ?? null;
}

export function isAuthEnabled(): boolean {
  return process.env.AUTH_DISABLED !== "1"; // on by default
}
