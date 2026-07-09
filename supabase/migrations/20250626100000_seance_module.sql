-- Flora — Module 6 : Générateur intelligent de séances

create table if not exists public.seances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sequence_session_id uuid not null references public.sequence_sessions(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  progression_id uuid not null references public.progressions(id) on delete cascade,
  progression_row_id uuid not null references public.progression_rows(id) on delete cascade,
  programmation_id uuid not null references public.programmations(id) on delete cascade,
  teacher_profile_id uuid references public.teacher_profiles(id) on delete set null,
  title text not null default '',
  matiere text not null default '',
  sous_matiere text not null default '',
  niveau text not null default '',
  cycle text not null default '',
  period_number integer not null default 0,
  week_number integer not null default 0,
  session_date date,
  duree_minutes integer not null default 45,
  competence_bo text not null default '',
  objectif text not null default '',
  prerequis jsonb not null default '[]'::jsonb,
  methode text not null default '',
  resource_ids jsonb not null default '[]'::jsonb,
  referentiel_ids jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  materiel jsonb not null default '{}'::jsonb,
  differentiation jsonb not null default '{}'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  homework jsonb not null default '{}'::jsonb,
  trace_ecrite jsonb not null default '{}'::jsonb,
  pedagogical_choices jsonb not null default '[]'::jsonb,
  status text not null default 'validated',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.seances add column if not exists created_at timestamptz not null default now();
alter table public.seances add column if not exists updated_at timestamptz not null default now();
alter table public.seances add column if not exists sequence_session_id uuid;
alter table public.seances add column if not exists sequence_id uuid;
alter table public.seances add column if not exists progression_id uuid;
alter table public.seances add column if not exists progression_row_id uuid;
alter table public.seances add column if not exists programmation_id uuid;
alter table public.seances add column if not exists teacher_profile_id uuid;
alter table public.seances add column if not exists title text not null default '';
alter table public.seances add column if not exists matiere text not null default '';
alter table public.seances add column if not exists sous_matiere text not null default '';
alter table public.seances add column if not exists niveau text not null default '';
alter table public.seances add column if not exists cycle text not null default '';
alter table public.seances add column if not exists period_number integer not null default 0;
alter table public.seances add column if not exists week_number integer not null default 0;
alter table public.seances add column if not exists session_date date;
alter table public.seances add column if not exists duree_minutes integer not null default 45;
alter table public.seances add column if not exists competence_bo text not null default '';
alter table public.seances add column if not exists objectif text not null default '';
alter table public.seances add column if not exists prerequis jsonb not null default '[]'::jsonb;
alter table public.seances add column if not exists methode text not null default '';
alter table public.seances add column if not exists resource_ids jsonb not null default '[]'::jsonb;
alter table public.seances add column if not exists referentiel_ids jsonb not null default '[]'::jsonb;
alter table public.seances add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.seances add column if not exists materiel jsonb not null default '{}'::jsonb;
alter table public.seances add column if not exists differentiation jsonb not null default '{}'::jsonb;
alter table public.seances add column if not exists evaluation jsonb not null default '{}'::jsonb;
alter table public.seances add column if not exists homework jsonb not null default '{}'::jsonb;
alter table public.seances add column if not exists trace_ecrite jsonb not null default '{}'::jsonb;
alter table public.seances add column if not exists pedagogical_choices jsonb not null default '[]'::jsonb;
alter table public.seances add column if not exists status text not null default 'validated';
alter table public.seances add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.seance_phases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  seance_id uuid not null references public.seances(id) on delete cascade,
  phase_key text not null default '',
  title text not null default '',
  sort_order integer not null default 0,
  duree_minutes integer not null default 5,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.seance_phases add column if not exists created_at timestamptz not null default now();
alter table public.seance_phases add column if not exists seance_id uuid;
alter table public.seance_phases add column if not exists phase_key text not null default '';
alter table public.seance_phases add column if not exists title text not null default '';
alter table public.seance_phases add column if not exists sort_order integer not null default 0;
alter table public.seance_phases add column if not exists duree_minutes integer not null default 5;
alter table public.seance_phases add column if not exists summary text not null default '';
alter table public.seance_phases add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.seance_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  seance_id uuid not null references public.seances(id) on delete cascade,
  phase_id uuid not null references public.seance_phases(id) on delete cascade,
  sort_order integer not null default 0,
  objectif text not null default '',
  consignes_enseignant text not null default '',
  consignes_eleves text not null default '',
  organisation text not null default '',
  duree_minutes integer not null default 5,
  variables_pedagogiques jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  reponses_attendues jsonb not null default '[]'::jsonb,
  erreurs_frequentes jsonb not null default '[]'::jsonb,
  remediations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.seance_activities add column if not exists created_at timestamptz not null default now();
alter table public.seance_activities add column if not exists seance_id uuid;
alter table public.seance_activities add column if not exists phase_id uuid;
alter table public.seance_activities add column if not exists sort_order integer not null default 0;
alter table public.seance_activities add column if not exists objectif text not null default '';
alter table public.seance_activities add column if not exists consignes_enseignant text not null default '';
alter table public.seance_activities add column if not exists consignes_eleves text not null default '';
alter table public.seance_activities add column if not exists organisation text not null default '';
alter table public.seance_activities add column if not exists duree_minutes integer not null default 5;
alter table public.seance_activities add column if not exists variables_pedagogiques jsonb not null default '[]'::jsonb;
alter table public.seance_activities add column if not exists questions jsonb not null default '[]'::jsonb;
alter table public.seance_activities add column if not exists reponses_attendues jsonb not null default '[]'::jsonb;
alter table public.seance_activities add column if not exists erreurs_frequentes jsonb not null default '[]'::jsonb;
alter table public.seance_activities add column if not exists remediations jsonb not null default '[]'::jsonb;
alter table public.seance_activities add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.seance_edit_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  seance_id uuid not null references public.seances(id) on delete cascade,
  entity_type text not null default '',
  entity_id uuid not null,
  field_path text not null default '',
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.seance_edit_history add column if not exists created_at timestamptz not null default now();
alter table public.seance_edit_history add column if not exists seance_id uuid;
alter table public.seance_edit_history add column if not exists entity_type text not null default '';
alter table public.seance_edit_history add column if not exists entity_id uuid;
alter table public.seance_edit_history add column if not exists field_path text not null default '';
alter table public.seance_edit_history add column if not exists previous_value jsonb;
alter table public.seance_edit_history add column if not exists new_value jsonb;
alter table public.seance_edit_history add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_unique_index_if_columns_exist(
  'seances_sequence_session_id_idx',
  'seances',
  array['sequence_session_id']
);
select public.flora_create_index_if_column_exists(
  'seances_sequence_id_idx',
  'seances',
  'sequence_id'
);
select public.flora_create_index_if_column_exists(
  'seance_phases_seance_id_idx',
  'seance_phases',
  'seance_id'
);
select public.flora_create_index_if_column_exists(
  'seance_activities_seance_id_idx',
  'seance_activities',
  'seance_id'
);
select public.flora_create_index_if_column_exists(
  'seance_activities_phase_id_idx',
  'seance_activities',
  'phase_id'
);
select public.flora_create_index_if_column_exists(
  'seance_edit_history_seance_id_idx',
  'seance_edit_history',
  'seance_id'
);

alter table public.seances enable row level security;
alter table public.seance_phases enable row level security;
alter table public.seance_activities enable row level security;
alter table public.seance_edit_history enable row level security;

drop policy if exists "seances_all_anon" on public.seances;
drop policy if exists "seance_phases_all_anon" on public.seance_phases;
drop policy if exists "seance_activities_all_anon" on public.seance_activities;
drop policy if exists "seance_edit_history_all_anon" on public.seance_edit_history;

create policy "seances_all_anon"
  on public.seances for all to anon using (true) with check (true);
create policy "seance_phases_all_anon"
  on public.seance_phases for all to anon using (true) with check (true);
create policy "seance_activities_all_anon"
  on public.seance_activities for all to anon using (true) with check (true);
create policy "seance_edit_history_all_anon"
  on public.seance_edit_history for all to anon using (true) with check (true);
