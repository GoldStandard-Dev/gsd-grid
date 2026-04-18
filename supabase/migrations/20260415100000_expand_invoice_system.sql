-- Expand invoices from the original placeholder table into the app-facing billing model.
do $$
begin
  alter type public.invoice_status add value if not exists 'unpaid';
  alter type public.invoice_status add value if not exists 'partial';
  alter type public.invoice_status add value if not exists 'overdue';
exception
  when undefined_object then null;
end $$;

alter table public.invoices
  add column if not exists invoice_number integer,
  add column if not exists client_name text,
  add column if not exists bill_to text,
  add column if not exists issue_date date,
  add column if not exists due_date date,
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists tax numeric(12,2) not null default 0,
  add column if not exists total numeric(12,2) not null default 0,
  add column if not exists deposit numeric(12,2) not null default 0,
  add column if not exists balance_due numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists invoices_org_invoice_number_idx
  on public.invoices(org_id, invoice_number)
  where invoice_number is not null;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sort_order integer not null default 0,
  qty numeric(12,2) not null default 1,
  unit text,
  item text,
  description text,
  unit_price numeric(12,2) not null default 0,
  taxable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoice_items enable row level security;

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  payment_date date not null default current_date,
  method text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.invoice_payments enable row level security;

create or replace function public.set_invoice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_invoice_updated_at();

drop trigger if exists trg_invoice_items_updated_at on public.invoice_items;
create trigger trg_invoice_items_updated_at
before update on public.invoice_items
for each row
execute function public.set_invoice_updated_at();

drop policy if exists "members can insert invoices" on public.invoices;
create policy "members can insert invoices"
on public.invoices for insert
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoices.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can update invoices" on public.invoices;
create policy "members can update invoices"
on public.invoices for update
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoices.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoices.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can delete invoices" on public.invoices;
create policy "members can delete invoices"
on public.invoices for delete
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoices.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can read invoice_items" on public.invoice_items;
create policy "members can read invoice_items"
on public.invoice_items for select
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_items.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can insert invoice_items" on public.invoice_items;
create policy "members can insert invoice_items"
on public.invoice_items for insert
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_items.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can update invoice_items" on public.invoice_items;
create policy "members can update invoice_items"
on public.invoice_items for update
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_items.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_items.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can delete invoice_items" on public.invoice_items;
create policy "members can delete invoice_items"
on public.invoice_items for delete
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_items.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can read invoice_payments" on public.invoice_payments;
create policy "members can read invoice_payments"
on public.invoice_payments for select
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_payments.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can insert invoice_payments" on public.invoice_payments;
create policy "members can insert invoice_payments"
on public.invoice_payments for insert
with check (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_payments.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "members can delete invoice_payments" on public.invoice_payments;
create policy "members can delete invoice_payments"
on public.invoice_payments for delete
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = invoice_payments.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);
