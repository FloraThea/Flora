-- Flora — Module 7 : Cahier Journal Intelligent

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid,
  school_year text not null default '',
  journal_date date not null,
  class_name text not null default '',
  effectif integer not null default 0,
  presents integer not null default 0,
  absents jsonb not null default '[]'::jsonb,
  daily_project text not null default '',
  main_objectives jsonb not null default '[]'::jsonb,
  important_info text not null default '',
  remarks text not null default '',
  period_number integer not null default 0,
  week_number integer not null default 0,
  status text not null default 'draft',
  dashboard jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.journals add column if not exists created_at timestamptz not null default now();
alter table public.journals add column if not exists updated_at timestamptz not null default now();
alter table public.journals add column if not exists teacher_profile_id uuid;
alter table public.journals add column if not exists school_year text not null default '';
alter table public.journals add column if not exists journal_date date;
alter table public.journals add column if not exists class_name text not null default '';
alter table public.journals add column if not exists effectif integer not null default 0;
alter table public.journals add column if not exists presents integer not null default 0;
alter table public.journals add column if not exists absents jsonb not null default '[]'::jsonb;
alter table public.journals add column if not exists daily_project text not null default '';
alter table public.journals add column if not exists main_objectives jsonb not null default '[]'::jsonb;
alter table public.journals add column if not exists important_info text not null default '';
alter table public.journals add column if not exists remarks text not null default '';
alter table public.journals add column if not exists period_number integer not null default 0;
alter table public.journals add column if not exists week_number integer not null default 0;
alter table public.journals add column if not exists status text not null default 'draft';
alter table public.journals add column if not exists dashboard jsonb not null default '{}'::jsonb;
alter table public.journals add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  sort_order integer not null default 0,
  entry_type text not null default 'slot',
  start_time text not null default '',
  end_time text not null default '',
  matiere text not null default '',
  seance_id uuid,
  ritual_id text,
  ritual_label text not null default '',
  competence text not null default '',
  objectif text not null default '',
  duree_minutes integer not null default 0,
  organisation text not null default '',
  materiel jsonb not null default '{}'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  observations text not null default '',
  slot_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.journal_entries add column if not exists journal_id uuid;
alter table public.journal_entries add column if not exists sort_order integer not null default 0;
alter table public.journal_entries add column if not exists entry_type text not null default 'slot';
alter table public.journal_entries add column if not exists start_time text not null default '';
alter table public.journal_entries add column if not exists end_time text not null default '';
alter table public.journal_entries add column if not exists matiere text not null default '';
alter table public.journal_entries add column if not exists seance_id uuid;
alter table public.journal_entries add column if not exists ritual_id text;
alter table public.journal_entries add column if not exists ritual_label text not null default '';
alter table public.journal_entries add column if not exists competence text not null default '';
alter table public.journal_entries add column if not exists objectif text not null default '';
alter table public.journal_entries add column if not exists duree_minutes integer not null default 0;
alter table public.journal_entries add column if not exists organisation text not null default '';
alter table public.journal_entries add column if not exists materiel jsonb not null default '{}'::jsonb;
alter table public.journal_entries add column if not exists documents jsonb not null default '[]'::jsonb;
alter table public.journal_entries add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.journal_entries add column if not exists observations text not null default '';
alter table public.journal_entries add column if not exists slot_data jsonb not null default '{}'::jsonb;
alter table public.journal_entries add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.journal_observations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  status text not null default 'realisee',
  actual_minutes integer,
  comments text not null default '',
  difficulties text not null default '',
  successes text not null default '',
  follow_up text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.journal_observations add column if not exists journal_entry_id uuid;
alter table public.journal_observations add column if not exists status text not null default 'realisee';
alter table public.journal_observations add column if not exists actual_minutes integer;
alter table public.journal_observations add column if not exists comments text not null default '';
alter table public.journal_observations add column if not exists difficulties text not null default '';
alter table public.journal_observations add column if not exists successes text not null default '';
alter table public.journal_observations add column if not exists follow_up text not null default '';
alter table public.journal_observations add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.journal_adjustments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  proposed_by text not null default 'thea',
  adjustment_type text not null default '',
  title text not null default '',
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.journal_adjustments add column if not exists journal_id uuid;
alter table public.journal_adjustments add column if not exists proposed_by text not null default 'thea';
alter table public.journal_adjustments add column if not exists adjustment_type text not null default '';
alter table public.journal_adjustments add column if not exists title text not null default '';
alter table public.journal_adjustments add column if not exists description text not null default '';
alter table public.journal_adjustments add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.journal_adjustments add column if not exists status text not null default 'pending';
alter table public.journal_adjustments add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.journal_exports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  export_format text not null default 'html',
  export_variant text not null default 'teacher',
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.journal_exports add column if not exists journal_id uuid;
alter table public.journal_exports add column if not exists export_format text not null default 'html';
alter table public.journal_exports add column if not exists export_variant text not null default 'teacher';
alter table public.journal_exports add column if not exists content text not null default '';
alter table public.journal_exports add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists('journals_date_idx', 'journals', 'journal_date');
select public.flora_create_index_if_column_exists('journals_profile_idx', 'journals', 'teacher_profile_id');
select public.flora_create_index_if_column_exists('journal_entries_journal_idx', 'journal_entries', 'journal_id');
select public.flora_create_index_if_column_exists('journal_entries_seance_idx', 'journal_entries', 'seance_id');
select public.flora_create_index_if_column_exists('journal_observations_entry_idx', 'journal_observations', 'journal_entry_id');
select public.flora_create_index_if_column_exists('journal_adjustments_journal_idx', 'journal_adjustments', 'journal_id');
select public.flora_create_index_if_column_exists('journal_exports_journal_idx', 'journal_exports', 'journal_id');

alter table public.journals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_observations enable row level security;
alter table public.journal_adjustments enable row level security;
alter table public.journal_exports enable row level security;

drop policy if exists "journals_all_anon" on public.journals;
drop policy if exists "journal_entries_all_anon" on public.journal_entries;
drop policy if exists "journal_observations_all_anon" on public.journal_observations;
drop policy if exists "journal_adjustments_all_anon" on public.journal_adjustments;
drop policy if exists "journal_exports_all_anon" on public.journal_exports;

create policy "journals_all_anon" on public.journals for all to anon using (true) with check (true);
create policy "journal_entries_all_anon" on public.journal_entries for all to anon using (true) with check (true);
create policy "journal_observations_all_anon" on public.journal_observations for all to anon using (true) with check (true);
create policy "journal_adjustments_all_anon" on public.journal_adjustments for all to anon using (true) with check (true);
create policy "journal_exports_all_anon" on public.journal_exports for all to anon using (true) with check (true);
