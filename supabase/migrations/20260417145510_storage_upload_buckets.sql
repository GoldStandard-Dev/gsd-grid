-- Storage buckets and policies for user avatars and organization branding.
-- These buckets are public because the app renders their public URLs directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('branding', 'branding', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public read branding assets" on storage.objects;
create policy "Public read branding assets"
on storage.objects
for select
using (bucket_id = 'branding');

drop policy if exists "Managers upload branding assets" on storage.objects;
create policy "Managers upload branding assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.org_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
);

drop policy if exists "Managers update branding assets" on storage.objects;
create policy "Managers update branding assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.org_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
)
with check (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.org_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
);

drop policy if exists "Managers delete branding assets" on storage.objects;
create policy "Managers delete branding assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.org_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  )
);
