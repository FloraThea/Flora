-- Flora — Module Agenda intelligent + suivi 108h

create table if not exists public.agenda_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  label text not null default '',
  kind text not null default 'event',
  color text not null default 'lavender',
  icon text not null default 'calendar',
  base_hours_100 numeric not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.agenda_categories add column if not exists code text;
alter table public.agenda_categories add column if not exists label text not null default '';
alter table public.agenda_categories add column if not exists kind text not null default 'event';
alter table public.agenda_categories add column if not exists color text not null default 'lavender';
alter table public.agenda_categories add column if not exists icon text not null default 'calendar';
alter table public.agenda_categories add column if not exists base_hours_100 numeric not null default 0;
alter table public.agenda_categories add column if not exists sort_order integer not null default 0;
alter table public.agenda_categories add column if not exists metadata jsonb not null default '{}'::jsonb;

insert into public.agenda_categories (code, label, kind, color, icon, base_hours_100, sort_order)
values
  ('cours', 'Cours', 'event', 'sage', 'book', 0, 1),
  ('seance', 'Séance', 'event', 'lavender', 'sparkles', 0, 2),
  ('rituel', 'Rituel', 'event', 'cream', 'sun', 0, 3),
  ('reunion', 'Réunion', 'event', 'peach', 'users', 0, 4),
  ('conseil_ecole', 'Conseil d''école', 'event', 'rose', 'school', 0, 5),
  ('animation_pedagogique', 'Animation pédagogique', 'event', 'sage', 'palette', 0, 6),
  ('apc', 'APC', 'event', 'lavender', 'puzzle', 0, 7),
  ('rdv_parents', 'Rendez-vous parents', 'event', 'rose', 'heart', 0, 8),
  ('ess', 'ESS', 'event', 'peach', 'leaf', 0, 9),
  ('equipe_educative', 'Équipe éducative', 'event', 'lavender', 'team', 0, 10),
  ('sortie', 'Sortie', 'event', 'sage', 'map', 0, 11),
  ('intervenant', 'Intervenant', 'event', 'cream', 'mic', 0, 12),
  ('piscine', 'Piscine', 'event', 'lavender', 'waves', 0, 13),
  ('spectacle', 'Spectacle', 'event', 'rose', 'star', 0, 14),
  ('evaluation', 'Évaluation', 'event', 'peach', 'clipboard', 0, 15),
  ('administratif', 'Date administrative', 'event', 'cream', 'file', 0, 16),
  ('vacances', 'Vacances', 'event', 'cream', 'palm', 0, 17),
  ('personnel', 'Événement personnel', 'event', 'rose', 'user', 0, 18),
  ('108_apc', 'APC (108h)', '108h', 'lavender', 'puzzle', 36, 20),
  ('108_animations', 'Animations pédagogiques (108h)', '108h', 'sage', 'palette', 36, 21),
  ('108_conseils', 'Conseils d''école (108h)', '108h', 'rose', 'school', 18, 22),
  ('108_equipe_familles', 'Équipe / familles / suivi / préparation APC (108h)', '108h', 'peach', 'users', 18, 23),
  ('108_pre_rentree', 'Pré-rentrée (108h)', '108h', 'cream', 'door', 6, 24),
  ('108_journee_academique', 'Journée académique (108h)', '108h', 'lavender', 'building', 6, 25),
  ('108_journee_solidarite', 'Journée de solidarité (108h)', '108h', 'cream', 'hand', 6, 26)
on conflict (code) do nothing;

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  school_year text not null default '',
  title text not null default '',
  description text not null default '',
  event_type text not null default 'personnel',
  category_code text not null default 'personnel',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text not null default '',
  color text not null default 'lavender',
  icon text not null default 'calendar',
  source_module text not null default 'manual',
  source_id text not null default '',
  status text not null default 'confirmed',
  duration_minutes integer not null default 60,
  auto_108h boolean not null default false,
  hours_108_entry_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.agenda_events add column if not exists teacher_profile_id uuid;
alter table public.agenda_events add column if not exists school_year text not null default '';
alter table public.agenda_events add column if not exists title text not null default '';
alter table public.agenda_events add column if not exists description text not null default '';
alter table public.agenda_events add column if not exists event_type text not null default 'personnel';
alter table public.agenda_events add column if not exists category_code text not null default 'personnel';
alter table public.agenda_events add column if not exists start_at timestamptz;
alter table public.agenda_events add column if not exists end_at timestamptz;
alter table public.agenda_events add column if not exists all_day boolean not null default false;
alter table public.agenda_events add column if not exists location text not null default '';
alter table public.agenda_events add column if not exists color text not null default 'lavender';
alter table public.agenda_events add column if not exists icon text not null default 'calendar';
alter table public.agenda_events add column if not exists source_module text not null default 'manual';
alter table public.agenda_events add column if not exists source_id text not null default '';
alter table public.agenda_events add column if not exists status text not null default 'confirmed';
alter table public.agenda_events add column if not exists duration_minutes integer not null default 60;
alter table public.agenda_events add column if not exists auto_108h boolean not null default false;
alter table public.agenda_events add column if not exists hours_108_entry_id uuid;
alter table public.agenda_events add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.agenda_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  title text not null default '',
  description text not null default '',
  priority text not null default 'medium',
  due_date date,
  category text not null default 'general',
  status text not null default 'todo',
  event_id uuid references public.agenda_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.agenda_tasks add column if not exists teacher_profile_id uuid;
alter table public.agenda_tasks add column if not exists title text not null default '';
alter table public.agenda_tasks add column if not exists description text not null default '';
alter table public.agenda_tasks add column if not exists priority text not null default 'medium';
alter table public.agenda_tasks add column if not exists due_date date;
alter table public.agenda_tasks add column if not exists category text not null default 'general';
alter table public.agenda_tasks add column if not exists status text not null default 'todo';
alter table public.agenda_tasks add column if not exists event_id uuid;
alter table public.agenda_tasks add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.agenda_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_profile_id uuid,
  target_type text not null default 'event',
  target_id uuid not null,
  remind_at timestamptz not null,
  offset_preset text not null default '1d',
  status text not null default 'pending',
  channel text not null default 'in_app',
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.agenda_reminders add column if not exists teacher_profile_id uuid;
alter table public.agenda_reminders add column if not exists target_type text not null default 'event';
alter table public.agenda_reminders add column if not exists target_id uuid;
alter table public.agenda_reminders add column if not exists remind_at timestamptz;
alter table public.agenda_reminders add column if not exists offset_preset text not null default '1d';
alter table public.agenda_reminders add column if not exists status text not null default 'pending';
alter table public.agenda_reminders add column if not exists channel text not null default 'in_app';
alter table public.agenda_reminders add column if not exists message text not null default '';
alter table public.agenda_reminders add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_108h_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  school_year text not null default '',
  entry_date date not null,
  category_code text not null default '108_apc',
  duration_minutes integer not null default 60,
  description text not null default '',
  location text not null default '',
  comments text not null default '',
  attachment_url text not null default '',
  source_event_id uuid references public.agenda_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.teacher_108h_entries add column if not exists teacher_profile_id uuid;
alter table public.teacher_108h_entries add column if not exists school_year text not null default '';
alter table public.teacher_108h_entries add column if not exists entry_date date;
alter table public.teacher_108h_entries add column if not exists category_code text not null default '108_apc';
alter table public.teacher_108h_entries add column if not exists duration_minutes integer not null default 60;
alter table public.teacher_108h_entries add column if not exists description text not null default '';
alter table public.teacher_108h_entries add column if not exists location text not null default '';
alter table public.teacher_108h_entries add column if not exists comments text not null default '';
alter table public.teacher_108h_entries add column if not exists attachment_url text not null default '';
alter table public.teacher_108h_entries add column if not exists source_event_id uuid;
alter table public.teacher_108h_entries add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_108h_summary (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  school_year text not null default '',
  category_code text not null default '',
  planned_minutes integer not null default 0,
  completed_minutes integer not null default 0,
  work_quota_percentage integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  unique (teacher_profile_id, school_year, category_code)
);

alter table public.teacher_108h_summary add column if not exists teacher_profile_id uuid;
alter table public.teacher_108h_summary add column if not exists school_year text not null default '';
alter table public.teacher_108h_summary add column if not exists category_code text not null default '';
alter table public.teacher_108h_summary add column if not exists planned_minutes integer not null default 0;
alter table public.teacher_108h_summary add column if not exists completed_minutes integer not null default 0;
alter table public.teacher_108h_summary add column if not exists work_quota_percentage integer not null default 100;
alter table public.teacher_108h_summary add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'agenda_events_teacher_start_idx',
  'agenda_events',
  'teacher_profile_id'
);

select public.flora_create_index_if_column_exists(
  'agenda_events_start_at_idx',
  'agenda_events',
  'start_at'
);

select public.flora_create_index_if_column_exists(
  'agenda_events_source_idx',
  'agenda_events',
  'source_module'
);

select public.flora_create_index_if_column_exists(
  'agenda_tasks_teacher_due_idx',
  'agenda_tasks',
  'teacher_profile_id'
);

select public.flora_create_index_if_column_exists(
  'agenda_reminders_remind_at_idx',
  'agenda_reminders',
  'remind_at'
);

select public.flora_create_index_if_column_exists(
  'teacher_108h_entries_teacher_date_idx',
  'teacher_108h_entries',
  'teacher_profile_id'
);
