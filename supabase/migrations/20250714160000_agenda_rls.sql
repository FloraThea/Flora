-- RLS agenda : alignement sur le reste de Flora + exigence teacher_profile_id

alter table public.agenda_categories enable row level security;
alter table public.agenda_events enable row level security;
alter table public.agenda_tasks enable row level security;
alter table public.agenda_reminders enable row level security;
alter table public.teacher_108h_entries enable row level security;
alter table public.teacher_108h_summary enable row level security;

drop policy if exists agenda_categories_read_anon on public.agenda_categories;
create policy agenda_categories_read_anon on public.agenda_categories
  for select to anon using (true);

drop policy if exists agenda_events_all_anon on public.agenda_events;
create policy agenda_events_all_anon on public.agenda_events
  for all to anon
  using (teacher_profile_id is not null)
  with check (teacher_profile_id is not null);

drop policy if exists agenda_tasks_all_anon on public.agenda_tasks;
create policy agenda_tasks_all_anon on public.agenda_tasks
  for all to anon
  using (teacher_profile_id is not null)
  with check (teacher_profile_id is not null);

drop policy if exists agenda_reminders_all_anon on public.agenda_reminders;
create policy agenda_reminders_all_anon on public.agenda_reminders
  for all to anon
  using (teacher_profile_id is not null)
  with check (teacher_profile_id is not null);

drop policy if exists teacher_108h_entries_all_anon on public.teacher_108h_entries;
create policy teacher_108h_entries_all_anon on public.teacher_108h_entries
  for all to anon
  using (teacher_profile_id is not null)
  with check (teacher_profile_id is not null);

drop policy if exists teacher_108h_summary_all_anon on public.teacher_108h_summary;
create policy teacher_108h_summary_all_anon on public.teacher_108h_summary
  for all to anon
  using (teacher_profile_id is not null)
  with check (teacher_profile_id is not null);

select public.flora_create_index_if_column_exists(
  'agenda_tasks_teacher_profile_idx',
  'agenda_tasks',
  'teacher_profile_id'
);

select public.flora_create_index_if_column_exists(
  'agenda_reminders_teacher_profile_idx',
  'agenda_reminders',
  'teacher_profile_id'
);

select public.flora_create_index_if_column_exists(
  'teacher_108h_entries_teacher_profile_idx',
  'teacher_108h_entries',
  'teacher_profile_id'
);

select public.flora_create_index_if_column_exists(
  'teacher_108h_summary_teacher_profile_idx',
  'teacher_108h_summary',
  'teacher_profile_id'
);
