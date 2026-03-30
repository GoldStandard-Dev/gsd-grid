-- ============================================================
-- GSD Grid App — Canonical Database Schema
-- Project: udueocsruydumlctqumg (GSD Grid App)
-- Applied via migrations:
--   001_enums_and_core_tables
--   002_rls_policies
--   003_accept_invite_rpc
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
create type member_role as enum (
  'owner',
  'general_manager',
  'operations_manager',
  'project_manager',
  'estimator',
  'office_admin',
  'hr_manager',
  'accounting_manager',
  'field_supervisor',
  'technician',
  'viewer'
);

create type member_status as enum ('active', 'invited', 'inactive');
create type wo_status as enum ('new', 'scheduled', 'in_progress', 'blocked', 'completed', 'canceled');
create type invoice_status as enum ('draft', 'sent', 'paid', 'void');
create type time_off_status as enum ('pending', 'approved', 'denied');
create type time_off_type as enum ('pto', 'sick', 'unpaid');
create type employee_status as enum ('active', 'inactive', 'terminated');

-- ============================================================
-- SHARED TRIGGER: updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  owner_user_id  uuid not null,
  created_at     timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- ============================================================
-- PROFILES (synced from auth.users via trigger)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  first_name  text,
  last_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ORG MEMBERS
-- ============================================================
create table public.org_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         member_role not null default 'viewer',
  status       member_status not null default 'active',
  display_name text,
  email        text,
  created_at   timestamptz not null default now(),
  unique (org_id, user_id)
);
alter table public.org_members enable row level security;

-- ============================================================
-- ORG INVITES
-- ============================================================
create table public.org_invites (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  email              text not null,
  role               member_role not null default 'viewer',
  token              text not null unique default gen_random_uuid()::text,
  status             text not null default 'pending'
                     check (status in ('pending','accepted','expired','revoked')),
  expires_at         timestamptz not null default (now() + interval '7 days'),
  created_at         timestamptz not null default now()
);
alter table public.org_invites enable row level security;

-- ============================================================
-- ORGANIZATION SETTINGS
-- ============================================================
create table public.organization_settings (
  org_id                              uuid primary key references public.organizations(id) on delete cascade,
  company_name                        text,
  phone                               text,
  website                             text,
  email                               text,
  address_search                      text,
  address1                            text,
  address2                            text,
  city                                text,
  state                               text,
  zip                                 text,
  logo_url                            text,
  tax_rate                            numeric(10,2) not null default 0,
  default_deposit                     numeric(12,2) not null default 0,
  invoice_prefix                      text not null default 'INV',
  payment_terms                       text,
  invoice_show_company_address        boolean not null default true,
  invoice_show_payment_terms          boolean not null default true,
  invoice_show_due_date               boolean not null default true,
  default_template                    text not null default 'General',
  workorder_show_measurements         boolean not null default true,
  workorder_enable_invoice_conversion boolean not null default true,
  workorder_include_signature         boolean not null default true,
  brand_theme                         text not null default 'Gold + White',
  notify_new_work_orders              boolean not null default true,
  notify_invoice_reminders            boolean not null default true,
  notify_team_activity                boolean not null default false,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),
  constraint org_settings_template_check check (
    default_template in ('General','Windows','Doors','Flooring','Painting','Electrical')
  ),
  constraint org_settings_brand_theme_check check (
    brand_theme in ('Gold + White','Minimal White','Classic Gold')
  )
);
create trigger trg_organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();
alter table public.organization_settings enable row level security;

-- ============================================================
-- CLIENTS
-- ============================================================
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  address1    text,
  address2    text,
  city        text,
  state       text,
  zip         text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();
alter table public.clients enable row level security;

-- ============================================================
-- WORK ORDERS
-- ============================================================
create table public.work_orders (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  client_id           uuid references public.clients(id) on delete set null,
  title               text not null,
  description         text,
  status              wo_status not null default 'new',
  template_name       text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id  uuid references auth.users(id) on delete set null,
  review_workflow     jsonb,
  grid_data           jsonb,
  scope_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();
alter table public.work_orders enable row level security;

-- ============================================================
-- WORK ORDER TEMPLATES
-- ============================================================
create table public.work_order_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  source_name text,
  headers     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.work_order_templates enable row level security;

-- ============================================================
-- INVOICES
-- ============================================================
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  work_order_id   uuid references public.work_orders(id) on delete set null,
  number          text,
  status          invoice_status not null default 'draft',
  subtotal_cents  int not null default 0,
  tax_cents       int not null default 0,
  total_cents     int not null default 0,
  notes           text,
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();
alter table public.invoices enable row level security;

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  org_id           uuid not null references public.organizations(id) on delete cascade,
  description      text not null,
  quantity         numeric(12,4) not null default 1,
  unit_price_cents int not null default 0,
  amount_cents     int not null default 0,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.invoice_items enable row level security;

-- ============================================================
-- PRICING COLLECTIONS
-- ============================================================
create table public.pricing_collections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  industry_type text,
  pricing_mode  text not null default 'unit'
                check (pricing_mode in ('matrix','unit','flat','labor','material','formula')),
  is_default    boolean not null default false,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_pricing_collections_updated_at
  before update on public.pricing_collections
  for each row execute function public.set_updated_at();
alter table public.pricing_collections enable row level security;

create table public.pricing_fabrics (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  collection_id      uuid not null references public.pricing_collections(id) on delete cascade,
  fabric_style       text not null,
  price_group        text not null,
  fabric_width       text,
  fr                 boolean not null default false,
  roller_shade       boolean not null default false,
  panel_track        boolean not null default false,
  multi_directional  boolean not null default false,
  created_at         timestamptz not null default now()
);
alter table public.pricing_fabrics enable row level security;

create table public.pricing_matrix_cells (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  collection_id uuid not null references public.pricing_collections(id) on delete cascade,
  price_group   text not null,
  width_to      numeric(10,2) not null,
  height_to     numeric(10,2) not null,
  price         numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.pricing_matrix_cells enable row level security;

create table public.pricing_surcharges (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  collection_id  uuid not null references public.pricing_collections(id) on delete cascade,
  surcharge_type text not null,
  width_to       numeric(10,2) not null,
  price          numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
alter table public.pricing_surcharges enable row level security;

create table public.pricing_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  collection_id uuid references public.pricing_collections(id) on delete set null,
  name          text not null,
  unit          text,
  price         numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.pricing_items enable row level security;

-- ============================================================
-- EMPLOYEES & HR
-- ============================================================
create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  first_name   text not null,
  last_name    text not null,
  email        text,
  phone        text,
  role         text,
  department   text,
  hire_date    date,
  status       employee_status not null default 'active',
  hourly_rate  numeric(10,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();
alter table public.employees enable row level security;

create table public.time_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  clock_in      timestamptz not null,
  clock_out     timestamptz,
  hours         numeric(6,2),
  notes         text,
  created_at    timestamptz not null default now()
);
alter table public.time_entries enable row level security;

create table public.time_off_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  type        time_off_type not null default 'pto',
  start_date  date not null,
  end_date    date not null,
  status      time_off_status not null default 'pending',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_time_off_requests_updated_at
  before update on public.time_off_requests
  for each row execute function public.set_updated_at();
alter table public.time_off_requests enable row level security;

create table public.employee_reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  reviewer_id  uuid references auth.users(id) on delete set null,
  review_date  date not null,
  rating       int check (rating between 1 and 5),
  notes        text,
  created_at   timestamptz not null default now()
);
alter table public.employee_reviews enable row level security;

create table public.employee_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  name         text not null,
  type         text,
  url          text,
  created_at   timestamptz not null default now()
);
alter table public.employee_documents enable row level security;

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
create table public.activity_log (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_name     text,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid not null,
  details        jsonb,
  created_at     timestamptz not null default now()
);
alter table public.activity_log enable row level security;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- ============================================================
-- CLIENT PORTAL ACCESS
-- ============================================================
create table public.client_portal_access (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  email         text not null,
  token         text not null unique default gen_random_uuid()::text,
  status        text not null default 'pending'
                check (status in ('pending','active','revoked')),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.client_portal_access enable row level security;
