// Defense against indirect prompt injection (OWASP LLM01).
// Everything that comes from a tool, retrieval, or external source is DATA, not
// instructions. We wrap it in a delimiter the model is told never to obey, and
// we neutralize attempts to (a) break out of that delimiter or (b) issue blatant
// instruction overrides. The delimiter + the system-prompt instruction hierarchy
// are the primary control; the regex below is conservative defense-in-depth.

export const UNTRUSTED_OPEN = "<untrusted_data";
export const UNTRUSTED_CLOSE = "</untrusted_data>";

// Only the clearest override patterns, to avoid corrupting legitimate content.
const INJECTION =
  /\b(ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions?|prompts?)|disregard\s+(the\s+)?(system|previous|above)|reveal\s+(your\s+)?(system\s+)?prompt|new\s+instructions?\s*:)/gi;

/** Wrap untrusted tool/retrieved content so the model treats it as data only. */
export function wrapUntrusted(source: string, content: string): string {
  const neutralized = String(content ?? "")
    // stop the content from closing/forging the delimiter
    .replaceAll(UNTRUSTED_OPEN, "&lt;untrusted_data")
    .replaceAll(UNTRUSTED_CLOSE, "&lt;/untrusted_data&gt;")
    // redact blatant instruction-override attempts hidden in the data
    .replace(INJECTION, "[filtered: possible prompt injection]");
  return `${UNTRUSTED_OPEN} source="${source}">\n${neutralized}\n${UNTRUSTED_CLOSE}`;
}
