# Employee Knowledge OS

An internal web app that interviews employees with an AI that asks smart, **branching** follow-up questions until it fully captures each person's working knowledge (tasks, tools, sheets, workflows, decisions, exceptions) — creating a structured "second brain" and live Standard Operating Procedure (SOP) per employee, across **any department**.

> New here or switching AI tools/agents? Read **[`docs/HANDOFF.md`](docs/HANDOFF.md)** first — it explains the full state, architecture, and how to continue.

---

## Features

- **Branching AI Interviewer**: Elicits deep operational knowledge across 12 coverage dimensions (triggers, steps, tools, decisions, exceptions, quality checks, approvals, etc.).
- **Evidence & Document Grounding**: Employees can upload task sheets, PDFs, and screenshots; parsed text is directly grounded into the interview turns.
- **Live Google Drive SOP Sync**: Automatically synthesizes publication-grade SOP Markdown (`.md`) documents for each employee and uploads/updates them in a Google Drive folder in real time as answers arrive.
- **Auditable & Non-Destructive**: Raw interview transcripts and AI-extracted facts are kept strictly separate; existing facts are never overwritten.
- **Admin Dashboard**: Manage employees, review live coverage progress, inspect full conversation threads, and export SOPs.

---

## Quick Start (Local)

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev                        # http://localhost:3000
```

1. Create a **Supabase** project → run `supabase/schema.sql` in the SQL editor.
2. Get an **OpenRouter** API key.
3. Configure Google Drive credentials (optional, for cloud SOP sync):
   - `GDRIVE_FOLDER_ID`: Your Google Drive / Shared Drive folder ID.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: Your Google Service Account key JSON.
4. Fill `.env.local` (see `.env.local.example`).
5. Open `/admin`, enter your `ADMIN_PASSPHRASE`, add an employee, and copy their link.
6. Open the link → conduct the interview.

---

## Google Drive SOP Sync

Every time an employee answers an interview question or uploads a document, their SOP Markdown document is updated in the background and pushed to your configured Google Shared Drive:

```bash
# Manually generate and sync all employee SOPs to Google Drive
npm run sync:drive
```

- Local copies are automatically cached in `exports/sops/`.
- A master directory index (`00_EMPLOYEES_INDEX.md`) is also generated and uploaded.

---

## Useful Scripts

| Command / Script | Purpose |
| :--- | :--- |
| `npm run dev` | Launch local Next.js development server. |
| `npm run build` | Validate and build the production bundle. |
| `npm run sync:drive` | Regenerate and upload all employee SOP Markdown files to Google Drive. |
| `node scripts/delete-selected-employees.mjs` | Cleanly cascade-delete selected employees and test data. |
| `node scripts/merge-meet-transcript.mjs` | Ingest and merge external interview transcripts into the database. |

---

## Documentation

- **Setup & Deployment**: [`docs/SETUP.md`](docs/SETUP.md)
- **Architecture & System Design**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Developer Handoff**: [`docs/HANDOFF.md`](docs/HANDOFF.md)
- **Progress & Roadmap**: [`docs/PROGRESS.md`](docs/PROGRESS.md)

---

## Stack

Next.js 16 (App Router, TS, Tailwind) · Supabase (Postgres + Storage + pgvector) · OpenRouter (LLM, default `google/gemini-2.5-flash`) · Google Drive API (`googleapis`) · Deepgram (voice, Phase 2) · Vercel (hosting).
