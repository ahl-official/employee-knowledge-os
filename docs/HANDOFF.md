# HANDOFF — read this first

This file lets any developer or AI coding agent pick up the project without prior context.

## What this project is

Company (American Hairline) wants to capture each employee's complete working knowledge before
people leave. An **AI interviewer** asks one question at a time and keeps **branching** into
follow-ups until each task is fully understood, then stores structured knowledge in a database.
Goal chain: interviews → SOPs → automations → per-employee AI agents. Must work for **any
department** (Editing, CRM, Finance, Sales, Inventory, …) with **no per-department code**.

Two earlier attempts live one folder up in `../employee-knowledge-os-appscript/` (reference only):
a working ChatGPT Custom GPT (`private-gpt/`, 6 real interviews in `Final_chat/`) and a **dropped**
Google Apps Script app. This Next.js app replaces both.

## Architecture (see `ARCHITECTURE.md` for the full reasoning)

- **No multi-agent, no RAG in the interview loop.** A deterministic state machine (our code) drives
  the flow; **one LLM call per turn** both analyzes the answer and returns the next question as JSON.
- **Structured retrieval, not vector RAG**, feeds the model a *compact* context (recent messages +
  current task + open branches) to control cost. Vector RAG (Supabase `pgvector`) is reserved for a
  future "query the whole knowledge base" feature.
- Secrets live server-side only. Employee auth = unguessable token in the URL. Admin auth = passphrase.

```
Employee browser ─▶ Next.js (Vercel) ─▶ API routes ─▶ orchestrator (lib/interview/store.ts)
                                                          ├─▶ Supabase (Postgres)
                                                          └─▶ OpenRouter (lib/interview/engine.ts)
```

## Key files

| Path | Purpose |
|---|---|
| `supabase/schema.sql` | Full DB schema. Run once in Supabase SQL editor. |
| `src/lib/config.ts` | All env access + `assertServerEnv()`. |
| `src/lib/supabase.ts` | Server (service-role) Supabase client. Server-only. |
| `src/lib/types.ts` | Domain types + `COVERAGE_KEYS` (the 12 coverage dimensions). |
| `src/lib/interview/prompt.ts` | Interviewer system prompt, JSON output contract, profile & fallback questions. |
| `src/lib/interview/engine.ts` | OpenRouter call, JSON parse/validate + 1 repair, deterministic fallback. Never throws. |
| `src/lib/interview/store.ts` | **The orchestrator.** Profile phase (steps 0-5 deterministic), deep-dive phase, `applyAnalysis`, `processDocument` (uploads), `getUploadsText` (doc grounding), progress. |
| `src/lib/parse.ts` | Convert uploaded file buffer → text: Excel/CSV (SheetJS), PDF (`unpdf`), Word (`mammoth`), image/scanned → vision. |
| `src/lib/interview/vision.ts` | Read an image/scanned page via the multimodal LLM (OpenRouter). |
| `src/app/api/upload/route.ts` | POST multipart file → Supabase Storage + extract text + grounded turn. |
| `src/app/api/interview/session/route.ts` | GET load/start interview by token. |
| `src/app/api/interview/answer/route.ts` | POST one answer → next question. |
| `src/app/api/admin/employees/route.ts` | GET list / POST create employee (passphrase). |
| `src/app/api/admin/transcript/route.ts` | GET full transcript + extracted knowledge. |
| `src/app/interview/[token]/` | Employee chat UI (`page.tsx` server + `InterviewClient.tsx`). |
| `src/app/admin/page.tsx` | Admin login + add employee + dashboard + transcript drawer. |

## The interview flow (how a turn works)

1. Employee submits answer → `POST /api/interview/answer` → `processAnswer(token, answer)`.
2. Raw answer saved to `messages` **immediately** (never lost).
3. If `session.profile_step <= 5`: store the profile field, ask the next fixed profile question (no LLM cost).
4. Step 6 (task-list answer) onward: build compact context → `runInterviewTurn()` → OpenRouter returns
   JSON (`facts, new_tasks, new_branches, resolved_branch_topics, coverage_update, current_task_complete,
   recommended_next_question, …`) → `applyAnalysis()` persists it → next question posted.
5. On any AI/JSON failure: a deterministic fallback question is returned so the session never breaks.

## Document/upload pipeline

Employee uploads a file (📎) → `/api/upload` stores the original in the Supabase Storage `uploads`
bucket → `lib/parse.ts` converts it to text (images/scanned PDFs use `lib/interview/vision.ts`) →
`processDocument` saves the `uploads` row (with `extracted_text`) and runs a grounded interview turn so
the AI extracts tasks and asks about the real sheet columns. Extracted text is injected into later turns
via `getUploadsText` → engine `documents`. Only the **text** is needed by the AI; the original file is
kept for records (Supabase Storage now; optional Google Drive backup via `GOOGLE_SERVICE_ACCOUNT_JSON` +
`GDRIVE_FOLDER_ID` — hook pending).

## Conventions

- **Next.js 16**: `params`/`searchParams` are Promises (`await params`). Use the global `PageProps<...>`
  helper for typed routes. Run `npx next typegen` after adding routes before `tsc`.
- Server-only secrets must NOT be prefixed `NEXT_PUBLIC_`.
- All DB access goes through the service-role client in server code; RLS is on with no public policies.
- Raw answers (`messages`) are append-only and kept separate from AI `facts` (anti-hallucination/audit).

## How to run / verify

```bash
npm install
cp .env.local.example .env.local     # fill keys (see SETUP.md)
# Run supabase/schema.sql in the Supabase SQL editor
npm run dev
npx tsc --noEmit                      # typecheck
npm run build                         # full build (currently green)
```

Manual test: `/admin` → add employee → open link → answer "I make reels" and confirm it asks *which
types* (branching); answer "Sir checks it" → it asks *who is Sir*; "I don't know" → it asks *who would
know*. See `PROGRESS.md` for the acceptance checklist.

## Current state (as of 2026-08-18)

**Phase 1 + Phase 2 are complete and verified live.**

- All 7 Supabase tables + `uploads` storage bucket are created and working.
- Supabase project ref: `iiewromktjaehcvfegsz` (region ap-northeast-1 Tokyo).
  DB via session pooler: `aws-0-ap-northeast-1.pooler.supabase.com:5432`, user `postgres.iiewromktjaehcvfegsz`.
- OpenRouter key in `.env.local`; model `google/gemini-2.5-flash` confirmed working.
- Dev server runs on **http://localhost:3001** (port 3000 is busy on this machine).
- Live-tested: branching ("I make reels" → "which types?"), "Sir" → resolved to manager,
  "I don't know" → "who would know?", CSV upload → 3 tasks auto-created, works for Editing + CRM.
- Admin UI redesigned (stats cards, avatar initials, tabbed transcript drawer, status badges).
- `npm run build` passes green (10 routes).

**Still TODO (in priority order):**
1. Deepgram voice STT mic input + browser read-aloud (API key needed from user)
2. Google Drive backup of uploaded originals (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GDRIVE_FOLDER_ID`)
3. Coverage + open-branches visual panel in the UI
4. Phase 3: SOP/second brain export per employee
5. Phase 3: pgvector cross-employee semantic search
6. GitHub push + Vercel deploy (user does this; needs all env vars in Vercel dashboard)

**Minor polish backlog:**
- Profile step 0 re-asks the name and overwrites the admin-entered name.
- `ADMIN_PASSPHRASE=1234` — weak; change before production.
- Keys were shared in chat; rotate Supabase service_role + OpenRouter key before production.
