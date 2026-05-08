# Screening Interview Agent

AI-driven screening interview agent that prepares role-aware questions, conducts a live interview through any web meeting tool, and produces a structured candidate report.

Built on Next.js 15 (App Router) + Supabase, deploys to Vercel.

## Stack

- **Web app:** Next.js 15, React 19, Tailwind v4, TypeScript
- **Auth + DB + Storage:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Vercel
- **LLM (later milestones):** Gemini Flash + Groq
- **Browser extension (later milestones):** MV3, Vite

## Roadmap (10 milestones)

1. **M1 — Foundation:** Next.js scaffold, Supabase auth, schema, deploy to Vercel ← *current*
2. **M2 — Intake:** Resume + JD wizard (both optional; only role title + seniority required)
3. **M3 — Question generation:** Gemini-backed question set, editable
4. **M4 — Extension shell:** MV3 side panel, lists prepared interviews
5. **M5 — Audio capture + live STT:** Tab capture, Web Speech API transcription
6. **M6 — Question delivery:** TTS / on-screen card flow
7. **M7 — Real-time follow-ups:** Groq-backed contextual follow-up engine
8. **M8 — Post-interview report:** Multi-dimensional scoring with evidence quotes
9. **M9 — Polish + multi-platform:** Meet / Zoom / Teams hardening, consent flow
10. **M10 — Launch:** Landing page, Web Store submission, rate limiting

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a new project (free tier).
2. Once provisioned, open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 3. Configure environment

```bash
cp .env.local.example .env.local
# fill in the three Supabase values
```

### 4. Run the schema migration

Open the Supabase **SQL Editor** and run the contents of [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql). This creates:

- `interviews`, `questions`, `transcripts`, `reports` tables
- Row-level security policies (owner-only access)
- A private `resumes` storage bucket with owner-scoped policies

### 5. Configure the auth redirect URL

In Supabase **Authentication → URL Configuration**, add the redirect URL:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://your-app.vercel.app/auth/callback`

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with a magic link, and you'll land in the (currently empty) dashboard.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New… → Project**, select the repo.
3. Add the same three Supabase env vars in **Settings → Environment Variables**.
4. Deploy. Add `https://your-app.vercel.app/auth/callback` to your Supabase auth redirect URLs.

## Project layout

```
src/
  app/
    page.tsx                    # redirects to /login or /dashboard
    layout.tsx                  # root layout
    login/page.tsx              # magic-link sign-in
    auth/callback/route.ts      # OAuth/magic-link callback handler
    auth/signout/route.ts       # sign-out POST handler
    dashboard/                  # gated app surface
  lib/supabase/
    client.ts                   # browser Supabase client
    server.ts                   # server Supabase client
    middleware.ts               # session refresh + route gating
  middleware.ts                 # Next.js middleware entry
supabase/
  migrations/
    0001_initial_schema.sql     # schema + RLS + storage setup
```
