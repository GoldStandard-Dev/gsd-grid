create table if not exists public.activity_user_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activity_log(id) on delete cascade,
  is_read boolean not null default false,
  cleared boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

create index if not exists activity_user_state_user_idx
  on public.activity_user_state(user_id);

create index if not exists activity_user_state_activity_idx
  on public.activity_user_state(activity_id);

create index if not exists activity_user_state_user_cleared_idx
  on public.activity_user_state(user_id, cleared);

create or replace function public.set_activity_user_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_activity_user_state_updated_at on public.activity_user_state;
create trigger trg_activity_user_state_updated_at
before update on public.activity_user_state
for each row
execute function public.set_activity_user_state_updated_at();

alter table public.activity_user_state enable row level security;

drop policy if exists "users can read their own activity state" on public.activity_user_state;
create policy "users can read their own activity state"
on public.activity_user_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can create their own activity state" on public.activity_user_state;
create policy "users can create their own activity state"
on public.activity_user_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update their own activity state" on public.activity_user_state;
create policy "users can update their own activity state"
on public.activity_user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete their own activity state" on public.activity_user_state;
create policy "users can delete their own activity state"
on public.activity_user_state
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.activity_user_state to authenticated;
