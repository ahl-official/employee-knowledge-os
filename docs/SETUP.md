# Setup — accounts, keys, run, deploy

## 1. Supabase (database)

1. Go to <https://supabase.com> → create a free project. Save the DB password.
2. **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → **Run**.
3. **Project Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. OpenRouter (LLM)

1. Go to <https://openrouter.ai> → sign in → add ~$5–10 credit.
2. Create an API key → `OPENROUTER_API_KEY`.
3. Default model is `google/gemini-2.5-flash`. Change `OPENROUTER_MODEL` to swap models later.

## 3. Admin passphrase

Pick any strong secret → `ADMIN_PASSPHRASE`. You'll type it to enter `/admin`.

## 4. Deepgram (voice — only needed for Phase 2)

<https://deepgram.com> → free account ($200 credit) → API key → `DEEPGRAM_API_KEY`.

## 5. Run locally

```bash
npm install
cp .env.local.example .env.local     # paste all keys from steps 1-3
npm run dev                          # http://localhost:3000
```

Open `/admin`, enter the passphrase, add an employee, copy the interview link, open it, and answer.

## 6. Push to GitHub

```bash
git init            # if not already a repo
git add .
git commit -m "Employee Knowledge OS — Phase 1"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

`.env.local` is gitignored — your keys are **not** pushed. Good.

## 7. Deploy on Vercel

1. <https://vercel.com> → New Project → import the GitHub repo.
2. **Environment Variables** — add every key from `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `ADMIN_PASSPHRASE`,
   and set `NEXT_PUBLIC_BASE_URL` to your Vercel URL (e.g. `https://your-app.vercel.app`).
   (Add `DEEPGRAM_API_KEY` when doing Phase 2.)
3. Deploy. Then update `NEXT_PUBLIC_BASE_URL` to the final domain and redeploy so generated interview
   links use the correct URL.

## Troubleshooting

- **"Missing required environment variables"** → a server key is unset in `.env.local` / Vercel.
- **Admin "unauthorized"** → `ADMIN_PASSPHRASE` mismatch.
- **Interview link "not valid"** → token doesn't exist; re-create the employee in `/admin`.
- **AI returns fallback questions repeatedly** → check `OPENROUTER_API_KEY` / credit / model id.
