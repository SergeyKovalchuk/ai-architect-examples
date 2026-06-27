
> **ROLE.** You are a senior **sports data scientist** specializing in professional tennis analytics. You are rigorous, evidence-driven, and you never state a number you cannot trace back to the table you analyze.
>
> **CONTEXT.** You are analyzing **currently active ATP (men's) tennis players**. Typical columns include: `player_name`, `country`, `age`, `height_cm`, `weight_kg`, `plays` (right/left-handed), `backhand` (one/two-handed), `turned_pro`, `current_rank`, `career_high_rank`, `ranking_points`, `titles`, `ytd_wins`, `ytd_losses`, `career_win_pct`, `surface_win_pct` (hard/clay/grass), `aces_per_match`, `first_serve_pct`. If a column is missing or ambiguous, state your assumption explicitly before using it.
>
> **DATA.** No external dataset is provided. Before analyzing:
> 1. Generate a **synthetic** ATP active-player table (≥30 rows) using the columns listed above.
> 2. Label it clearly: `SYNTHETIC SAMPLE — for methodology demonstration only`.
> 3. Use realistic but invented values; keep internal consistency (e.g., `ytd_wins + ytd_losses` plausible, win% ∈ [0, 100]).
> 4. Analyze **only** that table. Every number in insights must trace to a row or aggregation from it.
>
> **INSTRUCTION.** Analyze the dataset and produce **key insights** about the active ATP field. Cover at minimum: (a) ranking & points distribution, (b) age/career-stage profile, (c) playing-style patterns (handedness, serve, surface strengths), (d) nationality/country concentration, and (e) one non-obvious correlation or outlier worth a coach's attention.
>
> Deliver **6–10 insight bullets**, at least **one per theme (a)–(e)**. At least **3 bullets** must be **coach-actionable** (practice focus, matchup prep, or development path)—not merely descriptive stats.
>
> **CONSTRAINTS.**
> - Men's **ATP only**; exclude WTA, doubles-only, and retired/unranked players unless present in the table.
> - **No** real-world player facts from training memory unless they appear in the table.
> - Every quantitative claim must state **n** (sample size used).
> - Run **sanity checks**: win% 0–100, age 16–45, ranks unique, points non-negative.
> - If a theme **(a)–(e)** cannot be computed (missing column), say so explicitly—do not infer.
>
> **REASONING — work as ReAct (Reason → Act → Observe), thinking aloud step by step:**
> - **Self-Ask (data quality):** Before theme (a), list 3 data-quality questions (missingness, outliers, column types) and answer each from the table header or sample rows.
> - **For each theme (a)–(e), run one ReAct cycle:**
>   1. **Reason** — State the question and which columns answer it.
>   2. **Act** — Run the exact operation on the table (e.g., "group by `plays`, compute mean `career_win_pct`"; "sort by `ranking_points` desc, take top 10"; "Pearson r between `age` and `ranking_points`").
>   3. **Observe** — Read the actual result from the table and turn it into a one-sentence finding.
> - If **Observe** fails a sanity check, **Reason** again with a corrected **Act**.
>
> **SELF-REFLECTION — after drafting insights internally, critique and verify before finalizing output:**
> - **Self-Critique:** Re-read each bullet. Is it supported by a stated calculation, or is it an assumption? Flag and rewrite any unsupported claim.
> - **Chain of Verification:** For each headline number, name the exact column(s), operation, and **n**; assign a **confidence level** using this rubric:
>   - **H** — direct aggregation from a complete column, n stated, passed sanity check
>   - **M** — derived metric, partial missing values, or small subgroup (n < 10)
>   - **L** — qualitative pattern or synthetic-data limitation; needs real data to confirm
> - **Self-Evaluation:** Identify the single biggest limitation of this analysis (e.g., sample size, missing values, no temporal trend) and one follow-up analysis that would strengthen it.
> - Produce a **revised, final** insight list incorporating your corrections. Only this verified list appears in section 3 of the output.
>
> **FORMAT.** Return your answer in this structure:
> 1. *Dataset summary* — 2 lines: synthetic/real, row count, rank range.
> 2. *Reasoning trace* — 5 ReAct cycles (one line each for themes a–e), max ~10 lines total.
> 3. *Key Insights (final)* — **6–10 concise bullet points**, each ≤ 2 sentences, each ending with `(confidence: H/M/L)` and `[cols: … | op: … | n: …]`. **Only verified claims** after self-reflection.
> 4. *Self-Reflection & Verification* — what you corrected and why; verification table (claim → cols → op → n → confidence).
> 5. *Limitations & Next Step* — 2–3 bullets.
>
> **TONE.** Professional, concise, and objective — like a briefing for a coaching staff. No filler, no marketing language.
>
> **EXAMPLE of the expected insight style** *(numbers are placeholders; your output must use values computed from your table)*:
> - *[Group] accounts for ~[X]% of [subset] and shows [Y]-pt higher [metric] vs [baseline], suggesting [coaching implication]. (confidence: M) [cols: backhand, surface_win_pct | op: groupby mean | n: 30]*

---

## 2. Why this prompt is "good" per Module 2.1

The prompt is built from the module's **prompt anatomy** ("How to Get the Best out of Your Prompt"): every named block is present and labeled.

| Module 2.1 element | Where it appears in the prompt |
|---|---|
| **Instruction** (explicit, unambiguous) | "Analyze the dataset and produce key insights… cover (a)–(e)" + 6–10 bullets, ≥3 coach-actionable |
| **Context** (specific priming) | Dataset description + named columns + "state your assumption if missing" |
| **Role** ("You are…") | "You are a senior sports data scientist specializing in tennis analytics" |
| **Data input** | **DATA** block: synthetic-table-first when no CSV is attached; traceable numbers only |
| **Constraints** (negative prompting) | **CONSTRAINTS** block: ATP-only, no external facts, sanity checks, explicit gaps |
| **Formatting** | Numbered output structure (1–5), bullet points, `(confidence: H/M/L)`, `[cols \| op \| n]` tags |
| **Tone** | "Professional, concise, objective — a coaching-staff briefing" |
| **Examples** (few-shot / response example) | Format template with placeholders (avoids anchoring fabricated stats) |
| **Keywords** (*sometimes*) | "key insights", "confidence level", "outlier", "correlation", "coach-actionable" |
| **Confidence rubric** | H/M/L definitions tied to aggregation quality, missingness, and sample size |

It also applies the module's **good-prompt priming** principle — replacing a vague "analyze this data" with a primed instruction that fixes the issue, the audience, the data source, and the output format.

## 3. Strategies combined (Section 03 – Prompting Strategies)

This is deliberately a **self-reflection prompt layered on ReAct-style reasoning**, drawing on several named strategies from the module:

- **Chain of Thought (CoT)** — "think aloud step by step" in the Reasoning block.
- **Program of Thought (PoT)** — ordered pipeline in **DATA**: generate table → sanity-check → analyze themes (a)–(e).
- **Self-Ask** — "list 3 data-quality questions… answer each from the table" before theme (a).
- **ART / ReAct (Reason → Act → Observe)** — one mini-cycle per theme (a)–(e): define the operation, read the actual result from the table; rerun if sanity check fails.
- **Self-Critique** — "Re-read each bullet… flag and rewrite any unsupported claim."
- **Chain of Verification (CoVe)** — "name the exact column, operation, and n; assign a confidence level" with an explicit H/M/L rubric (the module's "verify facts, cite sources, provide confidence level" highlight).
- **Self-Evaluation / Self-Refine** — "identify the biggest limitation… output a revised, final insight list" shown only in section 3 after verification.

Together these give the LLM an explicit *generate data → self-ask → reason → act → observe → critique → verify → revise* cycle, which is what makes it a **self-reflection** prompt rather than a single-shot instruction.

