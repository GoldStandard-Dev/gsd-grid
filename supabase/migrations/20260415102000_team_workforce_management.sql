alter table if exists public.org_members
  add column if not exists department text,
  add column if not exists employee_type text,
  add column if not exists employment_status text,
  add column if not exists start_date date,
  add column if not exists manager_member_id uuid,
  add column if not exists supervisor_member_id uuid,
  add column if not exists team_name text,
  add column if not exists crew_name text,
  add column if not exists portal_type text,
  add column if not exists is_field_user boolean not null default false,
  add column if not exists can_clock_in boolean not null default false,
  add column if not exists mobile_access_enabled boolean not null default true,
  add column if not exists desktop_access_enabled boolean not null default true,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists address1 text,
  add column if not exists address2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists work_location text,
  add column if not exists profile_photo_url text,
  add column if not exists last_active_at timestamptz;

alter table if exists public.org_invites
  add column if not exists portal_type text,
  add column if not exists mobile_access_enabled boolean not null default true,
  add column if not exists desktop_access_enabled boolean not null default true,
  add column if not exists profile_photo_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists resent_at timestamptz;

create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  role_key text not null,
  description text,
  color text not null default '#6D28D9',
  portal_type text not null default 'team',
  permissions jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists organization_roles_org_portal_idx
  on public.organization_roles(org_id, portal_type);

create index if not exists org_members_org_portal_idx
  on public.org_members(org_id, portal_type);

create index if not exists org_members_org_manager_idx
  on public.org_members(org_id, manager_member_id);

create index if not exists org_members_org_department_idx
  on public.org_members(org_id, department);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.org_members(id) on delete cascade,
  document_type text not null,
  title text not null,
  file_url text,
  status text not null default 'active',
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_documents_member_idx
  on public.employee_documents(member_id, status, expires_at);

create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.org_members(id) on delete cascade,
  name text not null,
  issuing_authority text,
  status text not null default 'active',
  issued_at date,
  expires_at date,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_certifications_member_idx
  on public.employee_certifications(member_id, status, expires_at);

create table if not exists public.employee_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.org_members(id) on delete cascade,
  reviewer_member_id uuid references public.org_members(id) on delete set null,
  review_type text not null default 'performance',
  status text not null default 'draft',
  score numeric,
  notes text,
  due_at date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_reviews_member_idx
  on public.employee_reviews(member_id, status, due_at);

create table if not exists public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.org_members(id) on delete cascade,
  request_type text not null default 'time_off',
  status text not null default 'pending',
  starts_at date not null,
  ends_at date not null,
  notes text,
  approved_by_member_id uuid references public.org_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_time_off_member_idx
  on public.employee_time_off(member_id, status, starts_at);

create table if not exists public.employee_permissions_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.org_members(id) on delete cascade,
  permission_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, permission_key)
);

create index if not exists employee_permissions_overrides_member_idx
  on public.employee_permissions_overrides(member_id);

create table if not exists public.employee_activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.org_members(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_activity_log_org_created_idx
  on public.employee_activity_log(org_id, created_at desc);

create index if not exists employee_activity_log_member_created_idx
  on public.employee_activity_log(member_id, created_at desc);
