-- Employee Knowledge OS — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Safe to re-run: uses IF NOT EXISTS / idempotent guards.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  department        text,
  designation       text,
  reporting_manager text,
  experience        text,
  main_responsibility text,
  access_token      text not null unique,
  status            text not null default 'invited',      -- invited | in_progress | completed
  overall_progress  int  not null default 0,              -- 0-100
  current_task_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_activity     timestamptz
);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  round             int  not null default 1,
  status            text not null default 'active',       -- active | ended
  profile_step      int  not null default 0,              -- 0..6 profile Qs, 7 = deep-dive
  current_task_id   uuid,
  current_question  text,
  started_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_sessions_employee on public.sessions(employee_id);

-- ---------------------------------------------------------------------------
-- messages  (append-only raw transcript)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  session_id        uuid references public.sessions(id) on delete set null,
  role              text not null,                        -- assistant | user | system
  content           text not null,
  task_id           uuid,
  created_at        timestamptz not null default now()
);
create index if not exists idx_messages_employee on public.messages(employee_id, created_at);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  name              text not null,
  frequency         text,
  priority          text,
  status            text not null default 'pending',      -- pending | active | completed
  coverage          jsonb not null default '{}'::jsonb,   -- 12 dimensions, 0-100 each
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_tasks_employee on public.tasks(employee_id);

-- ---------------------------------------------------------------------------
-- facts  (AI-extracted knowledge, kept separate from raw answers)
-- ---------------------------------------------------------------------------
create table if not exists public.facts (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  message_id        uuid references public.messages(id) on delete set null,
  category          text not null,
  fact_text         text not null,
  source            text not null default 'ai_extracted', -- ai_extracted | raw | evidence
  created_at        timestamptz not null default now()
);
create index if not exists idx_facts_employee on public.facts(employee_id);

-- ---------------------------------------------------------------------------
-- branches  (open probing threads)
-- ---------------------------------------------------------------------------
create table if not exists public.branches (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  topic             text not null,
  priority          text not null default 'medium',       -- critical | high | medium | low
  status            text not null default 'open',         -- open | resolved
  suggested_question text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists idx_branches_employee on public.branches(employee_id, status);

-- ---------------------------------------------------------------------------
-- uploads  (their sheets / evidence files)
-- ---------------------------------------------------------------------------
create table if not exists public.uploads (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  file_url          text,                                 -- Supabase Storage path or external link
  file_name         text,
  mime_type         text,
  type              text,                                 -- sheet | pdf | doc | image | link
  extracted_text    text,                                 -- what the AI reads
  description       text,
  drive_url         text,                                 -- optional Google Drive backup link
  created_at        timestamptz not null default now()
);
create index if not exists idx_uploads_employee on public.uploads(employee_id);

-- Private storage bucket for original uploaded files.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: all access goes through the server (service role),
-- so we enable RLS and add NO public policies. The service-role key bypasses
-- RLS; the anon key gets no access. This keeps employee data private.
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.sessions  enable row level security;
alter table public.messages  enable row level security;
alter table public.tasks     enable row level security;
alter table public.facts     enable row level security;
alter table public.branches  enable row level security;
alter table public.uploads   enable row level security;
