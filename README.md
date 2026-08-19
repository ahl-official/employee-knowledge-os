# Employee Knowledge OS

An internal web app that interviews employees with an AI that asks smart, **branching** follow-up
questions until it fully captures each person's working knowledge (tasks, tools, sheets, workflows,
decisions, exceptions) — a structured "second brain" per employee, across **any department**.

> New here or switching AI tools/agents? Read **[`docs/HANDOFF.md`](docs/HANDOFF.md)** first — it
> explains the full state, architecture, and how to continue.

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev                          # http://localhost:3000
```

1. Create a **Supabase** project → run `supabase/schema.sql` in its SQL editor.
2. Get an **OpenRouter** API key.
3. Fill `.env.local` (see `.env.local.example`).
4. Open `/admin`, enter your `ADMIN_PASSPHRASE`, add an employee, copy their link.
5. Open the link → do the interview.

Full account/key/deploy steps: **[`docs/SETUP.md`](docs/SETUP.md)**.
Architecture & design decisions: **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.
Current progress & roadmap: **[`docs/PROGRESS.md`](docs/PROGRESS.md)**.

## Stack

Next.js 16 (App Router, TS, Tailwind) · Supabase (Postgres + Storage + pgvector) ·
OpenRouter (LLM, default `google/gemini-2.5-flash`) · Deepgram (voice, Phase 2) · Vercel (hosting).
