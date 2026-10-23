-- SplitSmart · Hour 5
-- Run this once in Supabase → SQL Editor. Row Level Security ensures users
-- can only read, create, and delete their own expense rows.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  emoji text not null default '🧾',
  paid_by text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  people integer not null default 1 check (people > 0),
  each numeric(12, 2),
  split_mode text not null default 'equal' check (split_mode in ('equal', 'custom')),
  splits jsonb not null default '[]'::jsonb check (jsonb_typeof(splits) = 'array'),
  created_at timestamptz not null default now()
);

-- These additions also bring a basic Hour 5 expenses table up to the schema
-- used by the current app (safe to run when the columns already exist).
alter table public.expenses add column if not exists description text;
alter table public.expenses add column if not exists people integer not null default 1;
alter table public.expenses add column if not exists each numeric(12, 2);
alter table public.expenses add column if not exists split_mode text not null default 'equal';
alter table public.expenses add column if not exists splits jsonb not null default '[]'::jsonb;

create index if not exists expenses_user_created_at_idx
  on public.expenses (user_id, created_at);

alter table public.expenses enable row level security;

drop policy if exists "Users can view their own expenses" on public.expenses;
create policy "Users can view their own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own expenses" on public.expenses;
create policy "Users can add their own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can delete their own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);
