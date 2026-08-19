# Progress & roadmap

_Last updated: 2026-08-18_

## Phase 1 — text interview MVP  ✅ code-complete, builds green

- [x] Next.js 16 + TS + Tailwind scaffold
- [x] Env/config module (`src/lib/config.ts`) + `.env.local.example`
- [x] Supabase schema (`supabase/schema.sql`) — employees, sessions, messages, tasks, facts, branches, uploads (+ RLS)
- [x] Interview engine (`src/lib/interview/engine.ts`) — OpenRouter call, JSON validate + 1 repair, deterministic fallback
- [x] Interviewer prompt + coverage contract + profile/fallback questions (`src/lib/interview/prompt.ts`)
- [x] Orchestrator (`src/lib/interview/store.ts`) — profile phase, deep-dive, applyAnalysis, progress
- [x] API routes — interview session/answer, admin employees/transcript
- [x] Employee chat UI (`/interview/[token]`) — progress bar, resume, thinking state
- [x] Admin UI (`/admin`) — passphrase, add employee + link, dashboard, transcript drawer
- [x] Docs (README, HANDOFF, ARCHITECTURE, SETUP, this file)
- [x] **Ran live against Supabase + OpenRouter (2026-08-18) — all acceptance scenarios pass**
  - Schema applied via `scripts/run-schema.mjs` (DB region: ap-northeast-1, session pooler).
  - Verified: profile phase, branching ("I make reels"→types), "Sir"→resolved to manager Mohit,
    "I don't know"→"who would know", facts/tasks/branches persisted, progress monotonic (fixed),
    CSV upload → file stored + text extracted + 3 tasks created + grounded question. Works for Editing & CRM.

### Polish backlog (minor)
- Profile step 0 re-asks the name and overwrites the admin-entered name. Consider skipping name Q when admin already set it.
- Local dev currently runs on **:3001** (port 3000 busy on this machine); `NEXT_PUBLIC_BASE_URL` set to 3001 to match.

## Acceptance checklist (run once keys are in)

1. Add employee in `/admin` → get link.
2. Profile questions asked one at a time (name → dept → role → manager → experience → responsibility → task list).
3. "I make reels" → asks **which types** (branching, no assumption).
4. "Educational and funny reels" → both tracked as separate threads.
5. "Sir checks it" → asks **who exactly is Sir**.
6. "I don't know" → raw saved, asks **who would know**, no invented answer.
7. Kill the OpenRouter key mid-interview → a fallback question appears, the answer is still saved.
8. Close tab and reopen the link → conversation + progress resume.
9. Admin transcript drawer shows tasks, facts, open follow-ups, full conversation.
10. Data in Supabase: `messages` append-only, `facts` separate, `tasks.coverage` updating.

## Phase 2 — uploads ✅ (voice still pending)

- [x] File upload pipeline: `/api/upload` stores original in Supabase Storage, extracts text, records `uploads` row
- [x] Parsers: Excel/CSV (SheetJS, patched CDN build), PDF (`unpdf`), Word (`mammoth`), image/scanned → Gemini vision (`lib/interview/vision.ts`)
- [x] `processDocument` runs a grounded interview turn on the uploaded doc (extracts tasks, asks about real columns)
- [x] Extracted text fed into every later turn (`getUploadsText` → engine `documents`)
- [x] Upload (📎) button in chat + profile step now invites uploading the task list
- [ ] **Google Drive backup** of originals — code hook + env vars ready; needs a Google service account (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GDRIVE_FOLDER_ID`). Until then originals live in Supabase Storage.
- [ ] Deepgram STT mic input (short-lived key minted server-side) + browser read-aloud
- [ ] Coverage + open-branches panel in the employee/admin UI

## Phase 3 — knowledge base (not started)

- [ ] SOP / "second brain" export per employee (Markdown / Google Doc), grounded only in captured facts
- [ ] Validation round (mark correct / needs-fix / approved)
- [ ] `pgvector` embeddings + cross-employee semantic search ("how does CRM handle dead leads?")

## Known caveats

- Vercel Hobby is technically non-commercial; may need Pro later.
- Supabase free project pauses after ~1 week idle (a click un-pauses).
- Long serverless calls: `answer` route sets `maxDuration = 60`; fine for Gemini Flash.
