-- Screening Interview Agent — initial schema
-- Run this in Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

-- INTERVIEWS ----------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_title text not null,
  seniority text not null check (seniority in ('intern','junior','mid','senior','staff','principal')),
  jd_text text,
  resume_storage_path text,
  resume_parsed jsonb,
  status text not null default 'draft' check (status in ('draft','ready','live','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_user_id_idx on public.interviews(user_id);
create index if not exists interviews_status_idx on public.interviews(status);

-- QUESTIONS -----------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  position int not null,
  category text not null check (category in ('technical','behavioral','resume_probe','role_specific','followup')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  prompt text not null,
  parent_question_id uuid references public.questions(id) on delete set null,
  edited boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_interview_id_idx on public.questions(interview_id);

-- TRANSCRIPTS ---------------------------------------------------------------
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  speaker text not null check (speaker in ('candidate','interviewer','agent')),
  content text not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists transcripts_interview_id_idx on public.transcripts(interview_id);
create index if not exists transcripts_question_id_idx on public.transcripts(question_id);

-- REPORTS -------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  scores jsonb not null,
  summary text,
  hire_recommendation text check (hire_recommendation in ('strong_hire','hire','lean_hire','no_hire','strong_no_hire')),
  confidence numeric(3,2),
  created_at timestamptz not null default now()
);

-- updated_at trigger --------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_interviews_updated_at on public.interviews;
create trigger trg_interviews_updated_at
before update on public.interviews
for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.interviews enable row level security;
alter table public.questions enable row level security;
alter table public.transcripts enable row level security;
alter table public.reports enable row level security;

-- interviews: owner-only
drop policy if exists "interviews_owner_all" on public.interviews;
create policy "interviews_owner_all" on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- questions / transcripts / reports: tied through interview ownership
drop policy if exists "questions_owner_all" on public.questions;
create policy "questions_owner_all" on public.questions
  for all using (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  );

drop policy if exists "transcripts_owner_all" on public.transcripts;
create policy "transcripts_owner_all" on public.transcripts
  for all using (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  );

drop policy if exists "reports_owner_all" on public.reports;
create policy "reports_owner_all" on public.reports
  for all using (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid())
  );

-- STORAGE -------------------------------------------------------------------
-- Resumes bucket (private). Run this only if the bucket does not already exist.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resumes_owner_select" on storage.objects;
create policy "resumes_owner_select" on storage.objects
  for select using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_owner_insert" on storage.objects;
create policy "resumes_owner_insert" on storage.objects
  for insert with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_owner_update" on storage.objects;
create policy "resumes_owner_update" on storage.objects
  for update using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_owner_delete" on storage.objects;
create policy "resumes_owner_delete" on storage.objects
  for delete using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
