-- supabase/migrations/20260308_create_organization_settings.sql
create table if not exists public.organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,

  company_name text,
  phone text,
  website text,
  email text,
  address_search text,
  address1 text,
  address2 text,
  city text,
  state text,
  zip text,

  tax_rate numeric(10,2) not null default 0,
  default_deposit numeric(12,2) not null default 0,
  invoice_prefix text not null default 'INV',
  payment_terms text,

  invoice_show_company_address boolean not null default true,
  invoice_show_payment_terms boolean not null default true,
  invoice_show_due_date boolean not null default true,

  default_template text not null default 'General',
  workorder_show_measurements boolean not null default true,
  workorder_enable_invoice_conversion boolean not null default true,
  workorder_include_signature boolean not null default true,

  brand_theme text not null default 'Gold + White',

  notify_new_work_orders boolean not null default true,
  notify_invoice_reminders boolean not null default true,
  notify_team_activity boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_settings_default_template_check
    check (default_template in ('General', 'Windows', 'Doors', 'Flooring', 'Painting', 'Electrical')),

  constraint organization_settings_brand_theme_check
    check (brand_theme in ('Gold + White', 'Minimal White', 'Classic Gold'))
);

create or replace function public.set_organization_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organization_settings_updated_at on public.organization_settings;
create trigger trg_organization_settings_updated_at
before update on public.organization_settings
for each row
execute function public.set_organization_settings_updated_at();

alter table public.organization_settings enable row level security;

drop policy if exists "organization_settings_select" on public.organization_settings;
create policy "organization_settings_select"
on public.organization_settings
for select
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = organization_settings.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "organization_settings_insert" on public.organization_settings;
create policy "organization_settings_insert"
on public.organization_settings
for insert
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = organization_settings.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
);

drop policy if exists "organization_settings_update" on public.organization_settings;
create policy "organization_settings_update"
on public.organization_settings
for update
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = organization_settings.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = organization_settings.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
);