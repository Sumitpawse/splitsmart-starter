-- SplitSmart Hour 6: private groups and group-scoped expenses.
-- Safe to re-run. Run after supabase/schema.sql in Supabase SQL Editor.
begin;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  join_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_default boolean not null default false
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.expenses
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

alter table public.groups add column if not exists is_default boolean not null default false;
create unique index if not exists groups_one_default_per_creator_idx
  on public.groups (created_by) where is_default;

-- Preserve each existing user's expenses in a private default group.
insert into public.groups (name, created_by, is_default)
select 'My Group', legacy.user_id, true
from (select distinct user_id from public.expenses where group_id is null) as legacy
on conflict (created_by) where is_default do nothing;

insert into public.group_members (group_id, user_id)
select id, created_by from public.groups where is_default
on conflict (group_id, user_id) do nothing;

update public.expenses as e
set group_id = g.id
from public.groups as g
where e.group_id is null and g.created_by = e.user_id and g.is_default;

alter table public.expenses alter column group_id set not null;
create index if not exists expenses_group_created_at_idx
  on public.expenses (group_id, created_at);

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if group_name is null or pg_catalog.char_length(pg_catalog.btrim(group_name)) not between 1 and 80 then
    raise exception 'Group name must be between 1 and 80 characters';
  end if;

  insert into public.groups (name, created_by)
  values (pg_catalog.btrim(group_name), auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id)
  values (new_group.id, auth.uid());

  return new_group.id;
end;
$$;

create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_to_join uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select id into group_to_join
  from public.groups
  where join_code = pg_catalog.upper(pg_catalog.btrim(code));

  if group_to_join is null then raise exception 'No group with that code'; end if;

  insert into public.group_members (group_id, user_id)
  values (group_to_join, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return group_to_join;
end;
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
revoke all on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

revoke all on public.groups, public.group_members, public.expenses from anon, authenticated;
grant select on public.groups, public.group_members to authenticated;
grant select, insert, delete on public.expenses to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Users can view their own expenses" on public.expenses;
drop policy if exists "Users can add their own expenses" on public.expenses;
drop policy if exists "Users can delete their own expenses" on public.expenses;
drop policy if exists "see my groups" on public.groups;
drop policy if exists "create groups" on public.groups;
drop policy if exists "see my memberships" on public.group_members;
drop policy if exists "join groups" on public.group_members;
drop policy if exists "see group expenses" on public.expenses;
drop policy if exists "add group expenses" on public.expenses;
drop policy if exists "delete group expenses" on public.expenses;

create policy "see my groups" on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy "see my memberships" on public.group_members
  for select to authenticated using (user_id = auth.uid());

create policy "see group expenses" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));

create policy "add group expenses" on public.expenses
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_group_member(group_id));

create policy "delete group expenses" on public.expenses
  for delete to authenticated using (public.is_group_member(group_id));

commit;
