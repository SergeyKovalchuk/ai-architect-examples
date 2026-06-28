// Lightweight, dependency-free guardrail layer.
// INPUT  guard: block obvious prompt-injection / jailbreak attempts on the user's question.
// OUTPUT guard: redact secrets and PII before an answer leaves the system.
//
// This is a pragmatic baseline with a stable interface. Production should add a
// managed layer behind the same functions (e.g. Azure AI Content Safety / Lakera
// for input, Microsoft Presidio for PII) — see docs/ARCHITECTURE.md.

export interface InputCheck { allowed: boolean; reason?: string }

const JAILBREAK = [
  /\bignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  /\bdisregard\s+(the\s+)?(system|previous|above)/i,
  /\b(reveal|show|print|repeat)\s+(your\s+)?(system\s+)?prompt/i,
  /\byou\s+are\s+now\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\bdeveloper\s+mode\b/i,
];

/** Screen the incoming user question (defense-in-depth on top of untrusted-data delimiting). */
export function checkInput(question: string): InputCheck {
  for (const re of JAILBREAK) {
    if (re.test(question)) return { allowed: false, reason: "possible prompt-injection / jailbreak attempt" };
  }
  return { allowed: true };
}

// Secret-shaped strings (API keys, bearer tokens) and common PII.
const SECRET_PATTERNS: [RegExp, string][] = [
  [/sk-[a-z0-9\-]{8,}/gi, "[REDACTED_KEY]"],
  [/\bBearer\s+[A-Za-z0-9._\-]{6,}/g, "Bearer [REDACTED]"],
  [/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]"],
  // Card BEFORE phone, so a 13-16 digit run isn't partially eaten by the phone rule.
  [/\b\d{13,16}\b/g, "[REDACTED_CARD]"],
  // Phone: requires groups of 2-4 consecutive digits, so it won't match tennis
  // scores like "6-4 6-4 6-2" (which never have 2+ consecutive digits).
  [/\+?\d{1,3}[\s.\-]?\(?\d{2,4}\)?[\s.\-]?\d{3}[\s.\-]?\d{3,4}/g, "[REDACTED_PHONE]"],
];

/** Redact secrets/PII from any text that leaves the system (answers, logs). */
export function redact(text: string): string {
  let out = String(text ?? "");
  for (const [re, repl] of SECRET_PATTERNS) out = out.replace(re, repl);
  return out;
}

/** Apply the output guard to an answer before returning it to the user. */
export function guardOutput(answer: string): { answer: string; redacted: boolean } {
  const cleaned = redact(answer);
  return { answer: cleaned, redacted: cleaned !== answer };
}
