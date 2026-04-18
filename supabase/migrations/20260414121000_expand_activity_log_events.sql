alter table public.activity_log
  add column if not exists actor_profile_id uuid,
  add column if not exists parent_entity_type text,
  add column if not exists parent_entity_id uuid,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists activity_log_parent_entity_idx
  on public.activity_log(parent_entity_type, parent_entity_id, created_at desc);

create index if not exists activity_log_action_idx
  on public.activity_log(org_id, action, created_at desc);
