-- Flora — Module 5 : Générateur de séquences pédagogiques

create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  progression_id uuid not null references public.progressions(id) on delete cascade,
  progression_row_id uuid not null references public.progression_rows(id) on delete cascade,
  programmation_id uuid not null references public.programmations(id) on delete cascade,
  progression_tab_id uuid references public.progression_tabs(id) on delete set null,
  title text not null default '',
  matiere text not null default '',
  sous_matiere text not null default '',
  cycle text not null default '',
  niveau text not null default '',
  period_number integer not null default 0,
  week_numbers jsonb not null default '[]'::jsonb,
  competence_bo text not null default '',
  attendus jsonb not null default '[]'::jsonb,
  objectifs jsonb not null default '[]'::jsonb,
  duree_estimee_minutes integer not null default 0,
  session_count integer not null default 0,
  prerequis jsonb not null default '[]'::jsonb,
  notions jsonb not null default '[]'::jsonb,
  vocabulaire jsonb not null default '[]'::jsonb,
  materiel jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  methode text not null default '',
  evaluation_finale jsonb not null default '{}'::jsonb,
  differentiation jsonb not null default '{}'::jsonb,
  prolongements jsonb not null default '[]'::jsonb,
  referentiel_ids jsonb not null default '[]'::jsonb,
  resource_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.sequences add column if not exists created_at timestamptz not null default now();
alter table public.sequences add column if not exists updated_at timestamptz not null default now();
alter table public.sequences add column if not exists progression_id uuid;
alter table public.sequences add column if not exists progression_row_id uuid;
alter table public.sequences add column if not exists programmation_id uuid;
alter table public.sequences add column if not exists progression_tab_id uuid;
alter table public.sequences add column if not exists title text not null default '';
alter table public.sequences add column if not exists matiere text not null default '';
alter table public.sequences add column if not exists sous_matiere text not null default '';
alter table public.sequences add column if not exists cycle text not null default '';
alter table public.sequences add column if not exists niveau text not null default '';
alter table public.sequences add column if not exists period_number integer not null default 0;
alter table public.sequences add column if not exists week_numbers jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists competence_bo text not null default '';
alter table public.sequences add column if not exists attendus jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists objectifs jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists duree_estimee_minutes integer not null default 0;
alter table public.sequences add column if not exists session_count integer not null default 0;
alter table public.sequences add column if not exists prerequis jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists notions jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists vocabulaire jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists materiel jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists resources jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists methode text not null default '';
alter table public.sequences add column if not exists evaluation_finale jsonb not null default '{}'::jsonb;
alter table public.sequences add column if not exists differentiation jsonb not null default '{}'::jsonb;
alter table public.sequences add column if not exists prolongements jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists referentiel_ids jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists resource_ids jsonb not null default '[]'::jsonb;
alter table public.sequences add column if not exists status text not null default 'draft';
alter table public.sequences add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.sequence_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  session_number integer not null default 1,
  title text not null default '',
  objectif text not null default '',
  duree_minutes integer not null default 45,
  ordre_pedagogique integer not null default 1,
  place_progression text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.sequence_sessions add column if not exists created_at timestamptz not null default now();
alter table public.sequence_sessions add column if not exists sequence_id uuid;
alter table public.sequence_sessions add column if not exists session_number integer not null default 1;
alter table public.sequence_sessions add column if not exists title text not null default '';
alter table public.sequence_sessions add column if not exists objectif text not null default '';
alter table public.sequence_sessions add column if not exists duree_minutes integer not null default 45;
alter table public.sequence_sessions add column if not exists ordre_pedagogique integer not null default 1;
alter table public.sequence_sessions add column if not exists place_progression text not null default '';
alter table public.sequence_sessions add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.sequence_evaluations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  evaluation_type text not null default '',
  label text not null default '',
  criteres jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.sequence_evaluations add column if not exists created_at timestamptz not null default now();
alter table public.sequence_evaluations add column if not exists sequence_id uuid;
alter table public.sequence_evaluations add column if not exists evaluation_type text not null default '';
alter table public.sequence_evaluations add column if not exists label text not null default '';
alter table public.sequence_evaluations add column if not exists criteres jsonb not null default '[]'::jsonb;
alter table public.sequence_evaluations add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'sequences_progression_id_idx',
  'sequences',
  'progression_id'
);
select public.flora_create_index_if_column_exists(
  'sequences_progression_row_id_idx',
  'sequences',
  'progression_row_id'
);
select public.flora_create_index_if_column_exists(
  'sequence_sessions_sequence_id_idx',
  'sequence_sessions',
  'sequence_id'
);
select public.flora_create_index_if_column_exists(
  'sequence_evaluations_sequence_id_idx',
  'sequence_evaluations',
  'sequence_id'
);

alter table public.sequences enable row level security;
alter table public.sequence_sessions enable row level security;
alter table public.sequence_evaluations enable row level security;

drop policy if exists "sequences_all_anon" on public.sequences;
drop policy if exists "sequence_sessions_all_anon" on public.sequence_sessions;
drop policy if exists "sequence_evaluations_all_anon" on public.sequence_evaluations;

create policy "sequences_all_anon"
  on public.sequences for all to anon using (true) with check (true);
create policy "sequence_sessions_all_anon"
  on public.sequence_sessions for all to anon using (true) with check (true);
create policy "sequence_evaluations_all_anon"
  on public.sequence_evaluations for all to anon using (true) with check (true);
