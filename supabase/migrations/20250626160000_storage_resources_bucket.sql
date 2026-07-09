-- Flora — Bucket Storage « resources » (PDF, ressources, BO)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  524288000,
  array[
    'application/pdf',
    'application/octet-stream',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resources_anon_select" on storage.objects;
drop policy if exists "resources_anon_insert" on storage.objects;
drop policy if exists "resources_anon_update" on storage.objects;
drop policy if exists "resources_anon_delete" on storage.objects;

create policy "resources_anon_select"
  on storage.objects for select to anon
  using (bucket_id = 'resources');

create policy "resources_anon_insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'resources');

create policy "resources_anon_update"
  on storage.objects for update to anon
  using (bucket_id = 'resources')
  with check (bucket_id = 'resources');

create policy "resources_anon_delete"
  on storage.objects for delete to anon
  using (bucket_id = 'resources');
