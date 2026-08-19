# Architecture & design decisions

## Guiding principle

Reverse-engineer the company cheaply. Keep the interview loop **simple, reliable, and low-cost**.
Do not over-engineer with multi-agent frameworks or premature vector search.

## LLM approach — decisions (and why)

### 1. Single call per turn, not multi-agent
Each employee answer triggers **one** OpenRouter call that returns a single JSON object doing two jobs:
extract structured knowledge **and** choose the next question. A separate "extractor agent" + "asker
agent" would double cost and latency for no real gain. Flow control (profile → task list → per-task)
is a **deterministic state machine in code** — no LLM router needed.

### 2. Structured retrieval now, vector RAG later
During the interview we send a **compact context** (role summary + current task + coverage + open
branches + last few Q&A), pulled from Postgres by keys — precise and cheap. We do **not** embed/search
the transcript to ask the next question. Vector RAG (Supabase `pgvector`, already available) is reserved
for a later feature: querying the whole captured knowledge base across employees.

### 3. Cost control
- Compact memory (never resend the full transcript).
- Low temperature (0.2) + strict JSON output.
- Default model `google/gemini-2.5-flash` (1M context, cheap). Swappable via `OPENROUTER_MODEL`.
- Estimated **~$0.40–1.00 per full interview**, ~$10–20 for 20 employees.

### 4. Reliability / anti-hallucination
- Raw answer saved **before** any AI call — an AI failure never loses data.
- JSON parsed, validated, and given **one repair attempt**; else a deterministic fallback question.
- Employee answers treated as data, not instructions (prompt-injection resistant).
- AI `facts` stored separately from raw `messages`; missing info is simply not invented.

## Data model (Postgres)

`employees` · `sessions` (holds `profile_step`, `current_task_id`) · `messages` (append-only transcript)
· `tasks` (with `coverage` jsonb: 12 dimensions) · `facts` (AI-extracted) · `branches` (open follow-ups)
· `uploads` (their sheets/evidence). RLS enabled, no public policies — all access via the server
service-role key.

## The 12 coverage dimensions (per task)

work_source, inputs, steps, research, tools, decisions, exceptions, failure_handling, quality_check,
approval, output, evidence. These are universal, so the same engine works for **any role/department** —
the AI generates role-appropriate questions from what the employee says; nothing is hardcoded per dept.

## Hosting & cost summary

| Service | Tier | Note |
|---|---|---|
| Vercel | Hobby (free) | Fine for build/internal use; Pro ($20/mo) if commercial-scale later. |
| Supabase | Free | 500MB DB, 1GB storage, pgvector; free project pauses after ~1 week idle. |
| Deepgram (voice, Phase 2) | $200 free credit | Covers the whole first batch (~4,800 min needed). |
| OpenRouter (LLM) | Pay-as-you-go | The only real cost. ~$10–20 for 20 interviews on Gemini Flash. |

## Roadmap

- **Phase 1 (done, code):** text interview end-to-end, admin dashboard, transcript view.
- **Phase 2:** Deepgram voice input + browser read-aloud, file upload of sheets, coverage/branch UI.
- **Phase 3:** SOP / "second brain" export (Markdown/Google Doc), validation round, `pgvector`-backed
  cross-employee knowledge search.
