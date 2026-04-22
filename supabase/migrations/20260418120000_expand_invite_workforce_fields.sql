alter table if exists public.org_invites
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists employee_type text,
  add column if not exists manager_member_id uuid,
  add column if not exists work_location text,
  add column if not exists start_date date;

create index if not exists org_invites_org_department_idx
  on public.org_invites(org_id, department);

create index if not exists org_invites_org_manager_idx
  on public.org_invites(org_id, manager_member_id);
