-- Flora — Module 8 : Emploi du temps intelligent

create table if not exists public.timetable_schedules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  name text not null default 'Emploi du temps principal',
  variant_type text not null default 'classique',
  is_active boolean not null default true,
  school_year text not null default '',
  levels jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  weekly_hours jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.timetable_schedules add column if not exists created_at timestamptz not null default now();
alter table public.timetable_schedules add column if not exists updated_at timestamptz not null default now();
alter table public.timetable_schedules add column if not exists teacher_profile_id uuid;
alter table public.timetable_schedules add column if not exists name text not null default 'Emploi du temps principal';
alter table public.timetable_schedules add column if not exists variant_type text not null default 'classique';
alter table public.timetable_schedules add column if not exists is_active boolean not null default true;
alter table public.timetable_schedules add column if not exists school_year text not null default '';
alter table public.timetable_schedules add column if not exists levels jsonb not null default '[]'::jsonb;
alter table public.timetable_schedules add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.timetable_schedules add column if not exists weekly_hours jsonb not null default '{}'::jsonb;
alter table public.timetable_schedules add column if not exists status text not null default 'draft';
alter table public.timetable_schedules add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schedule_id uuid not null references public.timetable_schedules(id) on delete cascade,
  day text not null default '',
  start_time text not null default '',
  end_time text not null default '',
  subject text not null default '',
  sub_subject text not null default '',
  slot_type text not null default 'seance',
  lock_level text not null default 'none',
  hours numeric not null default 1,
  room text not null default '',
  intervenant text not null default '',
  label text not null default '',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.timetable_slots add column if not exists schedule_id uuid;
alter table public.timetable_slots add column if not exists day text not null default '';
alter table public.timetable_slots add column if not exists start_time text not null default '';
alter table public.timetable_slots add column if not exists end_time text not null default '';
alter table public.timetable_slots add column if not exists subject text not null default '';
alter table public.timetable_slots add column if not exists sub_subject text not null default '';
alter table public.timetable_slots add column if not exists slot_type text not null default 'seance';
alter table public.timetable_slots add column if not exists lock_level text not null default 'none';
alter table public.timetable_slots add column if not exists hours numeric not null default 1;
alter table public.timetable_slots add column if not exists room text not null default '';
alter table public.timetable_slots add column if not exists intervenant text not null default '';
alter table public.timetable_slots add column if not exists label text not null default '';
alter table public.timetable_slots add column if not exists sort_order integer not null default 0;
alter table public.timetable_slots add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.timetable_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  schedule_id uuid not null references public.timetable_schedules(id) on delete cascade,
  version_number integer not null default 1,
  label text not null default '',
  variant_type text not null default 'classique',
  snapshot jsonb not null default '{}'::jsonb
);

alter table public.timetable_versions add column if not exists schedule_id uuid;
alter table public.timetable_versions add column if not exists version_number integer not null default 1;
alter table public.timetable_versions add column if not exists label text not null default '';
alter table public.timetable_versions add column if not exists variant_type text not null default 'classique';
alter table public.timetable_versions add column if not exists snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.timetable_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  schedule_id uuid not null references public.timetable_schedules(id) on delete cascade,
  action text not null default '',
  details jsonb not null default '{}'::jsonb
);

alter table public.timetable_history add column if not exists schedule_id uuid;
alter table public.timetable_history add column if not exists action text not null default '';
alter table public.timetable_history add column if not exists details jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'timetable_schedules_active_idx',
  'timetable_schedules',
  'is_active'
);

select public.flora_create_index_if_column_exists(
  'timetable_slots_schedule_idx',
  'timetable_slots',
  'schedule_id'
);

select public.flora_create_index_if_column_exists(
  'timetable_versions_schedule_idx',
  'timetable_versions',
  'schedule_id'
);

select public.flora_create_index_if_column_exists(
  'timetable_history_schedule_idx',
  'timetable_history',
  'schedule_id'
);

alter table public.timetable_schedules enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.timetable_versions enable row level security;
alter table public.timetable_history enable row level security;

drop policy if exists timetable_schedules_all_anon on public.timetable_schedules;
create policy timetable_schedules_all_anon on public.timetable_schedules
  for all to anon using (true) with check (true);

drop policy if exists timetable_slots_all_anon on public.timetable_slots;
create policy timetable_slots_all_anon on public.timetable_slots
  for all to anon using (true) with check (true);

drop policy if exists timetable_versions_all_anon on public.timetable_versions;
create policy timetable_versions_all_anon on public.timetable_versions
  for all to anon using (true) with check (true);

drop policy if exists timetable_history_all_anon on public.timetable_history;
create policy timetable_history_all_anon on public.timetable_history
  for all to anon using (true) with check (true);
