-- Flora — Fermeture RLS : tenant BO/référentiels, activation globale, policies permissives supprimées

-- Tenant sur documents BO (référentiels officiels importés par enseignant)
alter table public.bo_documents
  add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;

create index if not exists bo_documents_teacher_profile_id_idx
  on public.bo_documents(teacher_profile_id);

do $$
declare
  default_profile uuid;
begin
  select id into default_profile from public.teacher_profiles order by created_at asc limit 1;
  if default_profile is null then
    return;
  end if;

  update public.bo_documents
  set teacher_profile_id = default_profile
  where teacher_profile_id is null;
end $$;

-- Activer RLS sur toute table public sans protection
do $$
declare
  r record;
begin
  for r in
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- bo_documents : accès tenant (remplace bo_documents_all / bo_documents_read ouverts)
alter table public.bo_documents enable row level security;

drop policy if exists bo_documents_all on public.bo_documents;
drop policy if exists bo_documents_read on public.bo_documents;
drop policy if exists bo_documents_all_anon on public.bo_documents;
drop policy if exists "bo_documents_all_anon" on public.bo_documents;
drop policy if exists bo_documents_tenant on public.bo_documents;

create policy bo_documents_tenant on public.bo_documents
  for all to anon, authenticated
  using (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  )
  with check (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  );

-- referentiels : accès via document BO du tenant
alter table public.referentiels enable row level security;

drop policy if exists referentiels_all on public.referentiels;
drop policy if exists referentiels_read on public.referentiels;
drop policy if exists referentiels_all_anon on public.referentiels;
drop policy if exists "referentiels_all_anon" on public.referentiels;
drop policy if exists referentiels_tenant on public.referentiels;

create policy referentiels_tenant on public.referentiels
  for all to anon, authenticated
  using (
    document_source_id is null
    or exists (
      select 1 from public.bo_documents d
      where d.id = referentiels.document_source_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    document_source_id is not null
    and exists (
      select 1 from public.bo_documents d
      where d.id = referentiels.document_source_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- subject_mappings : policies ouvertes restantes
alter table public.subject_mappings enable row level security;

drop policy if exists subject_mappings_anon_all on public.subject_mappings;
drop policy if exists subject_mappings_tenant on public.subject_mappings;

create policy subject_mappings_tenant on public.subject_mappings
  for all to anon, authenticated
  using (
    (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
    or (user_id is not null and user_id = auth.uid())
  )
  with check (
    (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
    or (user_id is not null and user_id = auth.uid())
  );

-- Lots import programmation : supprimer policies permissives résiduelles
drop policy if exists programming_import_batches_all_anon on public.programming_import_batches;
drop policy if exists programming_import_files_all_anon on public.programming_import_files;

notify pgrst, 'reload schema';
