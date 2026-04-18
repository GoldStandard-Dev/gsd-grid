create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  user_id uuid not null,
  status text not null default 'active',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_id, user_id)
);

create index if not exists client_users_user_id_idx on public.client_users(user_id);
create index if not exists client_users_org_client_idx on public.client_users(org_id, client_id);

create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null,
  portal_type text not null check (portal_type in ('admin', 'team', 'client')),
  title text not null,
  body text,
  linked_entity_type text,
  linked_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_notifications_user_read_idx
  on public.portal_notifications(user_id, read_at, created_at desc);

alter table if exists public.org_members
  add column if not exists portal_type text;

alter table if exists public.work_orders
  add column if not exists client_visible_status text,
  add column if not exists visible_to_client boolean not null default false,
  add column if not exists visible_to_team boolean not null default true,
  add column if not exists requires_signature boolean not null default false;

alter table if exists public.work_order_items
  add column if not exists visible_to_client boolean not null default false,
  add column if not exists visible_to_team boolean not null default true,
  add column if not exists internal_only boolean not null default false,
  add column if not exists financial_visible boolean not null default false;

alter table if exists public.files
  add column if not exists visibility text not null default 'internal';

alter table if exists public.notes
  add column if not exists internal_only boolean not null default true,
  add column if not exists visible_to_client boolean not null default false,
  add column if not exists visible_to_team boolean not null default true;
