-- Flora — RLS étendue : profils, agenda, tables enfant, imports

-- Profils enseignants : accès par user_id
alter table public.teacher_profiles enable row level security;
drop policy if exists teacher_profiles_all_anon on public.teacher_profiles;
drop policy if exists teacher_profiles_tenant on public.teacher_profiles;
create policy teacher_profiles_tenant on public.teacher_profiles
  for all to anon, authenticated
  using (user_id is not distinct from auth.uid() or (auth.uid() is null and id in (select public.flora_accessible_profile_ids())))
  with check (user_id is not distinct from auth.uid() or (auth.uid() is null and id in (select public.flora_accessible_profile_ids())));

-- Préférences / méthodes / projets liés au profil
alter table public.teacher_preferences enable row level security;
drop policy if exists teacher_preferences_all_anon on public.teacher_preferences;
drop policy if exists teacher_preferences_tenant on public.teacher_preferences;
create policy teacher_preferences_tenant on public.teacher_preferences
  for all to anon, authenticated
  using (profile_id in (select public.flora_accessible_profile_ids()))
  with check (profile_id in (select public.flora_accessible_profile_ids()));

alter table public.teacher_methods enable row level security;
drop policy if exists teacher_methods_all_anon on public.teacher_methods;
drop policy if exists teacher_methods_tenant on public.teacher_methods;
create policy teacher_methods_tenant on public.teacher_methods
  for all to anon, authenticated
  using (profile_id in (select public.flora_accessible_profile_ids()))
  with check (profile_id in (select public.flora_accessible_profile_ids()));

alter table public.teacher_projects enable row level security;
drop policy if exists teacher_projects_all_anon on public.teacher_projects;
drop policy if exists teacher_projects_tenant on public.teacher_projects;
create policy teacher_projects_tenant on public.teacher_projects
  for all to anon, authenticated
  using (profile_id in (select public.flora_accessible_profile_ids()))
  with check (profile_id in (select public.flora_accessible_profile_ids()));

-- Agenda : tenant via teacher_profile_id
alter table public.agenda_events enable row level security;
drop policy if exists agenda_events_all_anon on public.agenda_events;
drop policy if exists agenda_events_tenant on public.agenda_events;
create policy agenda_events_tenant on public.agenda_events
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

alter table public.agenda_tasks enable row level security;
drop policy if exists agenda_tasks_all_anon on public.agenda_tasks;
drop policy if exists agenda_tasks_tenant on public.agenda_tasks;
create policy agenda_tasks_tenant on public.agenda_tasks
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

alter table public.agenda_reminders enable row level security;
drop policy if exists agenda_reminders_all_anon on public.agenda_reminders;
drop policy if exists agenda_reminders_tenant on public.agenda_reminders;
create policy agenda_reminders_tenant on public.agenda_reminders
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

alter table public.teacher_108h_entries enable row level security;
drop policy if exists teacher_108h_entries_all_anon on public.teacher_108h_entries;
drop policy if exists teacher_108h_entries_tenant on public.teacher_108h_entries;
create policy teacher_108h_entries_tenant on public.teacher_108h_entries
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

alter table public.teacher_108h_summary enable row level security;
drop policy if exists teacher_108h_summary_all_anon on public.teacher_108h_summary;
drop policy if exists teacher_108h_summary_tenant on public.teacher_108h_summary;
create policy teacher_108h_summary_tenant on public.teacher_108h_summary
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- Import programmation
alter table public.programming_import_batches enable row level security;
drop policy if exists programming_import_batches_all_anon on public.programming_import_batches;
drop policy if exists programming_import_batches_tenant on public.programming_import_batches;
create policy programming_import_batches_tenant on public.programming_import_batches
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

alter table public.programming_import_files enable row level security;
drop policy if exists programming_import_files_all_anon on public.programming_import_files;
drop policy if exists programming_import_files_tenant on public.programming_import_files;
create policy programming_import_files_tenant on public.programming_import_files
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.programming_import_batches b
      where b.id = programming_import_files.batch_id
        and b.teacher_profile_id is not null
        and public.flora_can_access_profile(b.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.programming_import_batches b
      where b.id = programming_import_files.batch_id
        and b.teacher_profile_id is not null
        and public.flora_can_access_profile(b.teacher_profile_id)
    )
  );

-- Programmation enfants
alter table public.programming_periods enable row level security;
drop policy if exists programming_periods_all_anon on public.programming_periods;
drop policy if exists programming_periods_tenant on public.programming_periods;
create policy programming_periods_tenant on public.programming_periods
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.programming_tables t
      join public.programmations p on p.id = t.programmation_id
      where t.id = programming_periods.table_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.programming_tables t
      join public.programmations p on p.id = t.programmation_id
      where t.id = programming_periods.table_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  );

alter table public.programming_cells enable row level security;
drop policy if exists programming_cells_all_anon on public.programming_cells;
drop policy if exists programming_cells_tenant on public.programming_cells;
create policy programming_cells_tenant on public.programming_cells
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.programming_tables t
      join public.programmations p on p.id = t.programmation_id
      where t.id = programming_cells.table_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.programming_tables t
      join public.programmations p on p.id = t.programmation_id
      where t.id = programming_cells.table_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  );

-- Progression tabs
alter table public.progression_tabs enable row level security;
drop policy if exists progression_tabs_all_anon on public.progression_tabs;
drop policy if exists progression_tabs_tenant on public.progression_tabs;
create policy progression_tabs_tenant on public.progression_tabs
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.progressions pr
      where pr.id = progression_tabs.progression_id
        and pr.teacher_profile_id is not null
        and public.flora_can_access_profile(pr.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.progressions pr
      where pr.id = progression_tabs.progression_id
        and pr.teacher_profile_id is not null
        and public.flora_can_access_profile(pr.teacher_profile_id)
    )
  );

-- Séquences enfants
alter table public.sequence_sessions enable row level security;
drop policy if exists sequence_sessions_all_anon on public.sequence_sessions;
drop policy if exists sequence_sessions_tenant on public.sequence_sessions;
create policy sequence_sessions_tenant on public.sequence_sessions
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.sequences s
      where s.id = sequence_sessions.sequence_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.sequences s
      where s.id = sequence_sessions.sequence_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

alter table public.sequence_evaluations enable row level security;
drop policy if exists sequence_evaluations_all_anon on public.sequence_evaluations;
drop policy if exists sequence_evaluations_tenant on public.sequence_evaluations;
create policy sequence_evaluations_tenant on public.sequence_evaluations
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.sequences s
      where s.id = sequence_evaluations.sequence_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.sequences s
      where s.id = sequence_evaluations.sequence_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

-- Séances enfants
alter table public.seance_phases enable row level security;
drop policy if exists seance_phases_all_anon on public.seance_phases;
drop policy if exists seance_phases_tenant on public.seance_phases;
create policy seance_phases_tenant on public.seance_phases
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_phases.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.seances s
      where s.id = seance_phases.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

alter table public.seance_activities enable row level security;
drop policy if exists seance_activities_all_anon on public.seance_activities;
drop policy if exists seance_activities_tenant on public.seance_activities;
create policy seance_activities_tenant on public.seance_activities
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_activities.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.seances s
      where s.id = seance_activities.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

alter table public.seance_edit_history enable row level security;
drop policy if exists seance_edit_history_all_anon on public.seance_edit_history;
drop policy if exists seance_edit_history_tenant on public.seance_edit_history;
create policy seance_edit_history_tenant on public.seance_edit_history
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_edit_history.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.seances s
      where s.id = seance_edit_history.seance_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

-- Documents enfants
alter table public.document_chunks enable row level security;
drop policy if exists document_chunks_all_anon on public.document_chunks;
drop policy if exists document_chunks_tenant on public.document_chunks;
create policy document_chunks_tenant on public.document_chunks
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

alter table public.document_tags enable row level security;
drop policy if exists document_tags_all_anon on public.document_tags;
drop policy if exists document_tags_tenant on public.document_tags;
create policy document_tags_tenant on public.document_tags
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_tags.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_tags.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

alter table public.document_competences enable row level security;
drop policy if exists document_competences_all_anon on public.document_competences;
drop policy if exists document_competences_tenant on public.document_competences;
create policy document_competences_tenant on public.document_competences
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_competences.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_competences.document_id
        and d.teacher_profile_id is not null
        and public.flora_can_access_profile(d.teacher_profile_id)
    )
  );

-- Journal siblings
alter table public.journal_observations enable row level security;
drop policy if exists journal_observations_all_anon on public.journal_observations;
drop policy if exists journal_observations_tenant on public.journal_observations;
create policy journal_observations_tenant on public.journal_observations
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.journal_entries e
      join public.journals j on j.id = e.journal_id
      where e.id = journal_observations.journal_entry_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.journal_entries e
      join public.journals j on j.id = e.journal_id
      where e.id = journal_observations.journal_entry_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  );

alter table public.journal_adjustments enable row level security;
drop policy if exists journal_adjustments_all_anon on public.journal_adjustments;
drop policy if exists journal_adjustments_tenant on public.journal_adjustments;
create policy journal_adjustments_tenant on public.journal_adjustments
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.journals j
      where j.id = journal_adjustments.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.journals j
      where j.id = journal_adjustments.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  );

alter table public.journal_exports enable row level security;
drop policy if exists journal_exports_all_anon on public.journal_exports;
drop policy if exists journal_exports_tenant on public.journal_exports;
create policy journal_exports_tenant on public.journal_exports
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.journals j
      where j.id = journal_exports.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.journals j
      where j.id = journal_exports.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  );

notify pgrst, 'reload schema';
