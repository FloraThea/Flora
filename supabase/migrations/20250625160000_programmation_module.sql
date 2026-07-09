-- Flora — Module 3 : Générateur de programmations

create table if not exists public.programmations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null default '',
  school_year text not null default '',
  academic_zone text not null default 'A',
  levels text[] not null default '{}',
  matiere text not null default '',
  methode text not null default '',
  projet_annuel text not null default '',
  timetable jsonb not null default '{}'::jsonb,
  calendar_snapshot jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.programmations add column if not exists created_at timestamptz not null default now();
alter table public.programmations add column if not exists updated_at timestamptz not null default now();
alter table public.programmations add column if not exists title text not null default '';
alter table public.programmations add column if not exists school_year text not null default '';
alter table public.programmations add column if not exists academic_zone text not null default 'A';
alter table public.programmations add column if not exists levels text[] not null default '{}';
alter table public.programmations add column if not exists matiere text not null default '';
alter table public.programmations add column if not exists methode text not null default '';
alter table public.programmations add column if not exists projet_annuel text not null default '';
alter table public.programmations add column if not exists timetable jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists calendar_snapshot jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists validation jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists status text not null default 'draft';
alter table public.programmations add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.programming_tables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  programmation_id uuid not null references public.programmations(id) on delete cascade,
  subject_key text not null default '',
  subject_label text not null default '',
  sub_subject_label text not null default '',
  sort_order integer not null default 0,
  accent text not null default 'lavender',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.programming_tables add column if not exists created_at timestamptz not null default now();
alter table public.programming_tables add column if not exists programmation_id uuid;
alter table public.programming_tables add column if not exists subject_key text not null default '';
alter table public.programming_tables add column if not exists subject_label text not null default '';
alter table public.programming_tables add column if not exists sub_subject_label text not null default '';
alter table public.programming_tables add column if not exists sort_order integer not null default 0;
alter table public.programming_tables add column if not exists accent text not null default 'lavender';
alter table public.programming_tables add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.programming_periods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  table_id uuid not null references public.programming_tables(id) on delete cascade,
  period_number integer not null,
  week_count numeric(5,2) not null default 0,
  start_date date,
  end_date date,
  label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  unique(table_id, period_number)
);

alter table public.programming_periods add column if not exists created_at timestamptz not null default now();
alter table public.programming_periods add column if not exists table_id uuid;
alter table public.programming_periods add column if not exists period_number integer;
alter table public.programming_periods add column if not exists week_count numeric(5,2) not null default 0;
alter table public.programming_periods add column if not exists start_date date;
alter table public.programming_periods add column if not exists end_date date;
alter table public.programming_periods add column if not exists label text not null default '';
alter table public.programming_periods add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.programming_cells (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  table_id uuid not null references public.programming_tables(id) on delete cascade,
  period_id uuid not null references public.programming_periods(id) on delete cascade,
  competences jsonb not null default '[]'::jsonb,
  notions jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  guides jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  content text not null default '',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.programming_cells add column if not exists created_at timestamptz not null default now();
alter table public.programming_cells add column if not exists updated_at timestamptz not null default now();
alter table public.programming_cells add column if not exists table_id uuid;
alter table public.programming_cells add column if not exists period_id uuid;
alter table public.programming_cells add column if not exists competences jsonb not null default '[]'::jsonb;
alter table public.programming_cells add column if not exists notions jsonb not null default '[]'::jsonb;
alter table public.programming_cells add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.programming_cells add column if not exists guides jsonb not null default '[]'::jsonb;
alter table public.programming_cells add column if not exists modules jsonb not null default '[]'::jsonb;
alter table public.programming_cells add column if not exists content text not null default '';
alter table public.programming_cells add column if not exists sort_order integer not null default 0;
alter table public.programming_cells add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_unique_index_if_columns_exist(
  'programming_periods_table_id_period_number_uidx',
  'programming_periods',
  array['table_id', 'period_number']
);

select public.flora_create_index_if_column_exists(
  'programmations_school_year_idx',
  'programmations',
  'school_year'
);
select public.flora_create_index_if_column_exists(
  'programming_tables_programmation_id_idx',
  'programming_tables',
  'programmation_id'
);
select public.flora_create_index_if_column_exists(
  'programming_periods_table_id_idx',
  'programming_periods',
  'table_id'
);
select public.flora_create_index_if_column_exists(
  'programming_cells_table_id_idx',
  'programming_cells',
  'table_id'
);
select public.flora_create_index_if_column_exists(
  'programming_cells_period_id_idx',
  'programming_cells',
  'period_id'
);

alter table public.programmations enable row level security;
alter table public.programming_tables enable row level security;
alter table public.programming_periods enable row level security;
alter table public.programming_cells enable row level security;

drop policy if exists "programmations_all_anon" on public.programmations;
drop policy if exists "programming_tables_all_anon" on public.programming_tables;
drop policy if exists "programming_periods_all_anon" on public.programming_periods;
drop policy if exists "programming_cells_all_anon" on public.programming_cells;

create policy "programmations_all_anon"
  on public.programmations for all to anon using (true) with check (true);
create policy "programming_tables_all_anon"
  on public.programming_tables for all to anon using (true) with check (true);
create policy "programming_periods_all_anon"
  on public.programming_periods for all to anon using (true) with check (true);
create policy "programming_cells_all_anon"
  on public.programming_cells for all to anon using (true) with check (true);
