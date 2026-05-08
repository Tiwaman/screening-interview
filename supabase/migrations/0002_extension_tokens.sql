-- Personal access tokens for the browser extension.
-- One row per active token; user generates, copies once, pastes into extension.

create table if not exists public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists extension_tokens_user_id_idx on public.extension_tokens(user_id);
create index if not exists extension_tokens_token_idx on public.extension_tokens(token);

alter table public.extension_tokens enable row level security;

drop policy if exists "extension_tokens_owner_all" on public.extension_tokens;
create policy "extension_tokens_owner_all" on public.extension_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
