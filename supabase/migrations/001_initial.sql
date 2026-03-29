-- useformly.ai MVP — forms + responses
-- Backend uses Supabase service role; no direct client DB access required for MVP.

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  slug text not null unique,
  definition jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forms_user_id_idx on public.forms (user_id);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists responses_form_id_idx on public.responses (form_id);

-- RLS on: PostgREST anon/authenticated have no policies → denied. API uses service role (bypasses RLS).
alter table public.forms enable row level security;
alter table public.responses enable row level security;
