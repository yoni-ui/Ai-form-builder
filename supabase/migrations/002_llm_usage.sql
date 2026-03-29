-- Daily LLM generation counts per signed-in user (UTC calendar day)

create table if not exists public.llm_usage (
  user_id uuid not null,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.llm_usage enable row level security;
