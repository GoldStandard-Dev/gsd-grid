create or replace function public.accept_org_invites_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_email    text;
  v_invite   record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email
  from auth.users
  where id = v_user_id;

  for v_invite in
    select *
    from public.org_invites
    where lower(trim(email)) = lower(trim(v_email))
      and status = 'pending'
  loop
    -- create member record only if not already a member of this org
    if not exists (
      select 1 from public.org_members
      where org_id = v_invite.org_id
        and user_id = v_user_id
    ) then
      insert into public.org_members (
        org_id,
        user_id,
        role,
        status,
        email,
        display_name,
        phone,
        job_title,
        department,
        employee_type,
        manager_member_id,
        work_location,
        start_date,
        profile_photo_url,
        portal_type,
        mobile_access_enabled,
        desktop_access_enabled,
        permissions,
        is_field_user
      ) values (
        v_invite.org_id,
        v_user_id,
        coalesce(v_invite.role, 'member'),
        'active',
        v_invite.email,
        v_invite.display_name,
        v_invite.phone,
        v_invite.job_title,
        v_invite.department,
        v_invite.employee_type,
        v_invite.manager_member_id,
        v_invite.work_location,
        v_invite.start_date,
        v_invite.profile_photo_url,
        v_invite.portal_type,
        coalesce(v_invite.mobile_access_enabled, true),
        coalesce(v_invite.desktop_access_enabled, true),
        coalesce(v_invite.permissions, '[]'::jsonb),
        coalesce(v_invite.portal_type = 'field', false)
      );
    end if;

    update public.org_invites
    set status = 'accepted'
    where id = v_invite.id;
  end loop;
end;
$$;

grant execute on function public.accept_org_invites_for_current_user() to authenticated;
