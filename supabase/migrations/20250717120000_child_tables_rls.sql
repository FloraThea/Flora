-- Flora — RLS tenant sur tables enfant (via parent)

-- timetable_slots → timetable_schedules
alter table public.timetable_slots enable row level security;
drop policy if exists timetable_slots_all_anon on public.timetable_slots;
drop policy if exists timetable_slots_tenant on public.timetable_slots;
create policy timetable_slots_tenant on public.timetable_slots
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_slots.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.timetable_schedules s
      where s.id = timetable_slots.schedule_id
        and s.teacher_profile_id is not null
        and public.flora_can_access_profile(s.teacher_profile_id)
    )
  );

-- journal_entries → journals
alter table public.journal_entries enable row level security;
drop policy if exists journal_entries_all_anon on public.journal_entries;
drop policy if exists journal_entries_tenant on public.journal_entries;
create policy journal_entries_tenant on public.journal_entries
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.journals j
      where j.id = journal_entries.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.journals j
      where j.id = journal_entries.journal_id
        and j.teacher_profile_id is not null
        and public.flora_can_access_profile(j.teacher_profile_id)
    )
  );

-- programming_tables → programmations
alter table public.programming_tables enable row level security;
drop policy if exists programming_tables_all_anon on public.programming_tables;
drop policy if exists programming_tables_tenant on public.programming_tables;
create policy programming_tables_tenant on public.programming_tables
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.programmations p
      where p.id = programming_tables.programmation_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.programmations p
      where p.id = programming_tables.programmation_id
        and p.teacher_profile_id is not null
        and public.flora_can_access_profile(p.teacher_profile_id)
    )
  );

-- progression_rows → progressions
alter table public.progression_rows enable row level security;
drop policy if exists progression_rows_all_anon on public.progression_rows;
drop policy if exists progression_rows_tenant on public.progression_rows;
create policy progression_rows_tenant on public.progression_rows
  for all to anon, authenticated
  using (
    exists (
      select 1 from public.progressions pr
      where pr.id = progression_rows.progression_id
        and pr.teacher_profile_id is not null
        and public.flora_can_access_profile(pr.teacher_profile_id)
    )
  )
  with check (
    exists (
      select 1 from public.progressions pr
      where pr.id = progression_rows.progression_id
        and pr.teacher_profile_id is not null
        and public.flora_can_access_profile(pr.teacher_profile_id)
    )
  );

notify pgrst, 'reload schema';
