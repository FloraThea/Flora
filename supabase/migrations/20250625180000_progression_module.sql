-- Flora — Module 4 : Générateur de progressions

create table if not exists public.progressions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  programmation_id uuid not null references public.programmations(id) on delete cascade,
  title text not null default '',
  methode text not null default '',
  status text not null default 'draft',
  validation jsonb not null default '{}'::jsonb,
  calendar_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.progressions add column if not exists created_at timestamptz not null default now();
alter table public.progressions add column if not exists updated_at timestamptz not null default now();
alter table public.progressions add column if not exists programmation_id uuid;
alter table public.progressions add column if not exists title text not null default '';
alter table public.progressions add column if not exists methode text not null default '';
alter table public.progressions add column if not exists status text not null default 'draft';
alter table public.progressions add column if not exists validation jsonb not null default '{}'::jsonb;
alter table public.progressions add column if not exists calendar_snapshot jsonb not null default '{}'::jsonb;
alter table public.progressions add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.progression_tabs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  progression_id uuid not null references public.progressions(id) on delete cascade,
  programming_table_id uuid references public.programming_tables(id) on delete set null,
  subject_key text not null default '',
  subject_label text not null default '',
  sub_subject_label text not null default '',
  sort_order integer not null default 0,
  accent text not null default 'lavender',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.progression_tabs add column if not exists created_at timestamptz not null default now();
alter table public.progression_tabs add column if not exists progression_id uuid;
alter table public.progression_tabs add column if not exists programming_table_id uuid;
alter table public.progression_tabs add column if not exists subject_key text not null default '';
alter table public.progression_tabs add column if not exists subject_label text not null default '';
alter table public.progression_tabs add column if not exists sub_subject_label text not null default '';
alter table public.progression_tabs add column if not exists sort_order integer not null default 0;
alter table public.progression_tabs add column if not exists accent text not null default 'lavender';
alter table public.progression_tabs add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.progression_rows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  progression_id uuid not null references public.progressions(id) on delete cascade,
  tab_id uuid not null references public.progression_tabs(id) on delete cascade,
  programmation_id uuid not null references public.programmations(id) on delete cascade,
  programming_table_id uuid references public.programming_tables(id) on delete set null,
  programming_period_id uuid references public.programming_periods(id) on delete set null,
  programming_cell_id uuid references public.programming_cells(id) on delete set null,
  referentiel_ids jsonb not null default '[]'::jsonb,
  resource_ids jsonb not null default '[]'::jsonb,
  period_number integer not null default 0,
  week_number integer not null default 0,
  session_number integer not null default 0,
  sequence_module text not null default '',
  seance_label text not null default '',
  competence_bo text not null default '',
  objectifs jsonb not null default '[]'::jsonb,
  deroulement text not null default '',
  materiel jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  remarques text not null default '',
  commentaires text not null default '',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.progression_rows add column if not exists created_at timestamptz not null default now();
alter table public.progression_rows add column if not exists updated_at timestamptz not null default now();
alter table public.progression_rows add column if not exists progression_id uuid;
alter table public.progression_rows add column if not exists tab_id uuid;
alter table public.progression_rows add column if not exists programmation_id uuid;
alter table public.progression_rows add column if not exists programming_table_id uuid;
alter table public.progression_rows add column if not exists programming_period_id uuid;
alter table public.progression_rows add column if not exists programming_cell_id uuid;
alter table public.progression_rows add column if not exists referentiel_ids jsonb not null default '[]'::jsonb;
alter table public.progression_rows add column if not exists resource_ids jsonb not null default '[]'::jsonb;
alter table public.progression_rows add column if not exists period_number integer not null default 0;
alter table public.progression_rows add column if not exists week_number integer not null default 0;
alter table public.progression_rows add column if not exists session_number integer not null default 0;
alter table public.progression_rows add column if not exists sequence_module text not null default '';
alter table public.progression_rows add column if not exists seance_label text not null default '';
alter table public.progression_rows add column if not exists competence_bo text not null default '';
alter table public.progression_rows add column if not exists objectifs jsonb not null default '[]'::jsonb;
alter table public.progression_rows add column if not exists deroulement text not null default '';
alter table public.progression_rows add column if not exists materiel jsonb not null default '[]'::jsonb;
alter table public.progression_rows add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.progression_rows add column if not exists remarques text not null default '';
alter table public.progression_rows add column if not exists commentaires text not null default '';
alter table public.progression_rows add column if not exists sort_order integer not null default 0;
alter table public.progression_rows add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'progressions_programmation_id_idx',
  'progressions',
  'programmation_id'
);
select public.flora_create_index_if_column_exists(
  'progression_tabs_progression_id_idx',
  'progression_tabs',
  'progression_id'
);
select public.flora_create_index_if_column_exists(
  'progression_rows_progression_id_idx',
  'progression_rows',
  'progression_id'
);
select public.flora_create_index_if_column_exists(
  'progression_rows_tab_id_idx',
  'progression_rows',
  'tab_id'
);

alter table public.progressions enable row level security;
alter table public.progression_tabs enable row level security;
alter table public.progression_rows enable row level security;

drop policy if exists "progressions_all_anon" on public.progressions;
drop policy if exists "progression_tabs_all_anon" on public.progression_tabs;
drop policy if exists "progression_rows_all_anon" on public.progression_rows;

create policy "progressions_all_anon"
  on public.progressions for all to anon using (true) with check (true);
create policy "progression_tabs_all_anon"
  on public.progression_tabs for all to anon using (true) with check (true);
create policy "progression_rows_all_anon"
  on public.progression_rows for all to anon using (true) with check (true);
