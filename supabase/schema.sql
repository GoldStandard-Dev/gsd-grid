-- Enable UUID generation (Supabase usually has this available)
-- create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null,
  created_at timestamptz not null default now()
);

create type member_status as enum ('active', 'invited', 'inactive');
create type member_role as enum ('owner', 'manager', 'dispatcher', 'technician', 'bookkeeper', 'viewer');

create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role member_role not null default 'viewer',
  status member_status not null default 'active',
  display_name text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

-- Placeholders (you’ll flesh these out next)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create type wo_status as enum ('new','scheduled','in_progress','blocked','completed','canceled');

create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  description text,
  status wo_status not null default 'new',
  assigned_to_user_id uuid,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type invoice_status as enum ('draft','sent','paid','void');

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  work_order_id uuid references work_orders(id) on delete set null,
  status invoice_status not null default 'draft',
  total_cents int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS (basic org isolation - you can tighten this per-role later)
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table activity_log enable row level security;
alter table clients enable row level security;
alter table work_orders enable row level security;
alter table invoices enable row level security;

-- Helper: membership check via org_members (simple policies)
create policy "members can read org"
on organizations for select
using (exists (
  select 1 from org_members m
  where m.org_id = organizations.id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

create policy "members can read members"
on org_members for select
using (exists (
  select 1 from org_members m
  where m.org_id = org_members.org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

create policy "members can read activity"
on activity_log for select
using (exists (
  select 1 from org_members m
  where m.org_id = activity_log.org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

create policy "members can read clients"
on clients for select
using (exists (
  select 1 from org_members m
  where m.org_id = clients.org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

create policy "members can read work_orders"
on work_orders for select
using (exists (
  select 1 from org_members m
  where m.org_id = work_orders.org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

create policy "members can read invoices"
on invoices for select
using (exists (
  select 1 from org_members m
  where m.org_id = invoices.org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));