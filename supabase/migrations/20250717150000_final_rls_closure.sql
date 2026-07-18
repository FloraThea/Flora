-- Flora — RLS finale : fermeture tables ouvertes, référentiel BO lecture seule

-- Macro : tables liées à documents.teacher_profile_id
-- document_import_jobs, document_upload_*, document_versions, document_segments,
-- document_relations, document_import_notifications, knowledge_index,
-- pedagogical_entities, pedagogical_relations, bo_competence_links

-- document_import_jobs
alter table public.document_import_jobs enable row level security;
drop policy if exists document_import_jobs_all_anon on public.document_import_jobs;
drop policy if exists document_import_jobs_tenant on public.document_import_jobs;
create policy document_import_jobs_tenant on public.document_import_jobs
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_import_jobs.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_import_jobs.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- document_upload_sessions (via document_id ou metadata teacher)
alter table public.document_upload_sessions enable row level security;
drop policy if exists document_upload_sessions_all_anon on public.document_upload_sessions;
drop policy if exists document_upload_sessions_tenant on public.document_upload_sessions;
create policy document_upload_sessions_tenant on public.document_upload_sessions
  for all to anon, authenticated
  using (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = document_upload_sessions.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = document_upload_sessions.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- document_upload_chunks
alter table public.document_upload_chunks enable row level security;
drop policy if exists document_upload_chunks_all_anon on public.document_upload_chunks;
drop policy if exists document_upload_chunks_tenant on public.document_upload_chunks;
create policy document_upload_chunks_tenant on public.document_upload_chunks
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.document_upload_sessions s
      left join public.documents d on d.id = s.document_id
      where s.id = document_upload_chunks.session_id
        and (s.document_id is null or (d.teacher_profile_id is not null and public.flora_can_access_profile(d.teacher_profile_id)))
    )
  )
  with check (
    exists (
      select 1 from public.document_upload_sessions s
      left join public.documents d on d.id = s.document_id
      where s.id = document_upload_chunks.session_id
        and (s.document_id is null or (d.teacher_profile_id is not null and public.flora_can_access_profile(d.teacher_profile_id)))
    )
  );

-- document_versions
alter table public.document_versions enable row level security;
drop policy if exists document_versions_all_anon on public.document_versions;
drop policy if exists document_versions_tenant on public.document_versions;
create policy document_versions_tenant on public.document_versions
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- document_segments
alter table public.document_segments enable row level security;
drop policy if exists document_segments_all_anon on public.document_segments;
drop policy if exists document_segments_tenant on public.document_segments;
create policy document_segments_tenant on public.document_segments
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_segments.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_segments.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- document_relations
alter table public.document_relations enable row level security;
drop policy if exists document_relations_all_anon on public.document_relations;
drop policy if exists "document_relations_all_anon" on public.document_relations;
drop policy if exists document_relations_tenant on public.document_relations;
create policy document_relations_tenant on public.document_relations
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_relations.source_document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_relations.source_document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- document_import_notifications
alter table public.document_import_notifications enable row level security;
drop policy if exists document_import_notifications_all_anon on public.document_import_notifications;
drop policy if exists document_import_notifications_tenant on public.document_import_notifications;
create policy document_import_notifications_tenant on public.document_import_notifications
  for all to anon, authenticated
  using (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = document_import_notifications.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = document_import_notifications.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- knowledge_index
alter table public.knowledge_index enable row level security;
drop policy if exists knowledge_index_all_anon on public.knowledge_index;
drop policy if exists "knowledge_index_all_anon" on public.knowledge_index;
drop policy if exists knowledge_index_tenant on public.knowledge_index;
create policy knowledge_index_tenant on public.knowledge_index
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = knowledge_index.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = knowledge_index.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- pedagogical_entities
alter table public.pedagogical_entities enable row level security;
drop policy if exists pedagogical_entities_all_anon on public.pedagogical_entities;
drop policy if exists "pedagogical_entities_all_anon" on public.pedagogical_entities;
drop policy if exists pedagogical_entities_tenant on public.pedagogical_entities;
create policy pedagogical_entities_tenant on public.pedagogical_entities
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = pedagogical_entities.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = pedagogical_entities.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- pedagogical_relations
alter table public.pedagogical_relations enable row level security;
drop policy if exists pedagogical_relations_all_anon on public.pedagogical_relations;
drop policy if exists "pedagogical_relations_all_anon" on public.pedagogical_relations;
drop policy if exists pedagogical_relations_tenant on public.pedagogical_relations;
create policy pedagogical_relations_tenant on public.pedagogical_relations
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = pedagogical_relations.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = pedagogical_relations.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- bo_competence_links (via document utilisateur)
alter table public.bo_competence_links enable row level security;
drop policy if exists bo_competence_links_all_anon on public.bo_competence_links;
drop policy if exists "bo_competence_links_all_anon" on public.bo_competence_links;
drop policy if exists bo_competence_links_tenant on public.bo_competence_links;
create policy bo_competence_links_tenant on public.bo_competence_links
  for all to anon, authenticated
  using (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = bo_competence_links.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = bo_competence_links.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- pedagogical_change_log
alter table public.pedagogical_change_log enable row level security;
drop policy if exists pedagogical_change_log_all_anon on public.pedagogical_change_log;
drop policy if exists "pedagogical_change_log_all_anon" on public.pedagogical_change_log;
drop policy if exists pedagogical_change_log_tenant on public.pedagogical_change_log;
create policy pedagogical_change_log_tenant on public.pedagogical_change_log
  for all to anon, authenticated
  using (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  )
  with check (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  );

-- timetable_versions + timetable_history
alter table public.timetable_versions enable row level security;
drop policy if exists timetable_versions_all_anon on public.timetable_versions;
drop policy if exists timetable_versions_tenant on public.timetable_versions;
create policy timetable_versions_tenant on public.timetable_versions
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_versions.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_versions.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

alter table public.timetable_history enable row level security;
drop policy if exists timetable_history_all_anon on public.timetable_history;
drop policy if exists timetable_history_tenant on public.timetable_history;
create policy timetable_history_tenant on public.timetable_history
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_history.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_history.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

-- Référentiel BO : lecture publique, écriture réservée service_role (bypass RLS)
alter table public.referentiels enable row level security;
drop policy if exists referentiels_all_anon on public.referentiels;
drop policy if exists "referentiels_all_anon" on public.referentiels;
drop policy if exists referentiels_read on public.referentiels;
create policy referentiels_read on public.referentiels
  for select to anon, authenticated
  using (true);

alter table public.bo_documents enable row level security;
drop policy if exists bo_documents_all_anon on public.bo_documents;
drop policy if exists "bo_documents_all_anon" on public.bo_documents;
drop policy if exists bo_documents_read on public.bo_documents;
create policy bo_documents_read on public.bo_documents
  for select to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
