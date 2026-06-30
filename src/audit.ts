// Audit logging + observability hook (dependency-free core).
//
// Emits one structured record per request. The question is NOT logged verbatim —
// only a length + SHA-256 hash (privacy by default); free text is redacted of
// secrets/PII via guardrails.redact. Records go to stdout as JSON lines (ship to
// Loki/Datadog/Elastic in prod) and to an optional observability sink (Langfuse /
// OpenTelemetry) which is enabled only when OBSERVABILITY=1 and a sink is wired.
import crypto from "node:crypto";
import { redact } from "./guardrails.js";

export interface AuditRecord {
  ts: string;
  event: "ask";
  user: string;
  roles: string[];
  questionHash: string;
  questionChars: number;
  toolsUsed: string[];
  citations: string[];
  refused: boolean;
  blocked: boolean;        // input guard tripped
  outputRedacted: boolean; // output guard scrubbed something
  latencyMs: number;
  provider: string;
  error?: string;
}

function hash(s: string): string {
  return "sha256:" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// Optional observability sink (e.g. Langfuse/OpenTelemetry). Off unless wired.
type Sink = (r: AuditRecord) => void;
let _sink: Sink | null = null;
export function setObservabilitySink(sink: Sink) { _sink = sink; }
const observabilityEnabled = () => process.env.OBSERVABILITY === "1";

/** Build an audit record (question reduced to length+hash; never logged raw). */
export function buildAuditRecord(input: {
  question: string;
  user: string; roles: string[];
  toolsUsed: string[]; citations: string[];
  refused: boolean; blocked: boolean; outputRedacted: boolean;
  latencyMs: number; provider: string; error?: string;
}): AuditRecord {
  return {
    ts: new Date().toISOString(),
    event: "ask",
    user: input.user,
    roles: input.roles,
    questionHash: hash(input.question),
    questionChars: input.question.length,
    toolsUsed: input.toolsUsed,
    citations: input.citations,
    refused: input.refused,
    blocked: input.blocked,
    outputRedacted: input.outputRedacted,
    latencyMs: input.latencyMs,
    provider: input.provider,
    ...(input.error ? { error: redact(input.error) } : {}),
  };
}

/** Write the audit record (JSON line) and forward to the observability sink if enabled. */
export function audit(record: AuditRecord): void {
  process.stdout.write(JSON.stringify({ audit: record }) + "\n");
  if (observabilityEnabled() && _sink) {
    try { _sink(record); } catch { /* never let telemetry break the request */ }
  }
}
