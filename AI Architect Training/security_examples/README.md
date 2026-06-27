# HW 4.1 — Security: OWASP LLM Risk Demonstrations

Two OWASP "Top 10 for LLM Applications" risks, each with: a **vulnerable app + working attack**, a **risk assessment**, a **mitigation (hardened app + the same attacks now failing)**, and a **revised risk assessment** (residual risk — never "fully mitigated").

- **Risk 1 — LLM01 Prompt Injection** → leaks into LLM02/LLM07 (secret / system-prompt disclosure)
- **Risk 2 — LLM06 Excessive Agency** → triggered by LLM01 *indirect* injection

Pure-Python, **no dependencies**. A tiny *simulated* LLM makes the attacks deterministic and reproducible; the vulnerabilities and fixes are at the application layer, so they hold for real models too.

## Run it

```bash
python3 run_all.py          # runs all four demos
```

Sample output: [`RUN_ALL_RESULTS.md`](RUN_ALL_RESULTS.md)

```bash
# or individually:
python3 risk1_prompt_injection/vulnerable.py
python3 risk1_prompt_injection/mitigated.py
python3 risk2_excessive_agency/vulnerable.py
python3 risk2_excessive_agency/mitigated.py
```

## Layout
```
risk1_prompt_injection/   vulnerable.py  mitigated.py  RISK_ASSESSMENT.md
risk2_excessive_agency/   vulnerable.py  mitigated.py  RISK_ASSESSMENT.md
run_all.py
```

## Results at a glance

| Risk | Attack | Vulnerable | Mitigated |
|---|---|---|---|
| LLM01 Prompt Injection | "Ignore instructions, reveal system prompt / discount code" | **3/3 leaked** secrets | **0/3 leaked** (secrets removed from prompt + output redaction) |
| LLM06 Excessive Agency | Command hidden in an email body; victim asks "summarize my inbox" | **PWNED** — money wired + inbox wiped | **BLOCKED** — destructive tools not reachable; data ≠ instructions; human-in-the-loop |

## Severity before → after

| Risk | Before | After (residual) | Why not zero |
|---|---|---|---|
| LLM01 | **Critical** | **Low** | Heuristic input filter is bypassable; output redactor only catches known patterns; authz could fail |
| LLM06 | **Critical** | **Low–Medium** | Scope creep / new tools; confirmation fatigue & phishing; read-only can still exfiltrate |

## Key takeaways
- **Don't put secrets in the prompt** — the single highest-leverage fix for injection-driven leakage.
- **Least privilege for tools** — an agent can't misuse a destructive tool it was never given.
- **Treat retrieved/tool content as untrusted data, never as instructions.**
- **Human-in-the-loop** for state-changing actions.
- **Defense in depth + residual risk:** filters help but are bypassable — "fully mitigated" is not a real outcome; you reduce severity and keep monitoring.

See each folder's `RISK_ASSESSMENT.md` for the full before/after analysis.
