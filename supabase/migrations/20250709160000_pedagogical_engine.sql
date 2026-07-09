-- Moteur Pédagogique Intelligent : historique cross-modules + IDs référentiel

create table if not exists public.pedagogical_change_log (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid references public.teacher_profiles(id) on delete set null,
  module text not null,
  entity_type text not null,
  entity_id text not null,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  event_type text not null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by_log_id uuid references public.pedagogical_change_log(id) on delete set null
);

create index if not exists pedagogical_change_log_created_at_idx
  on public.pedagogical_change_log (created_at desc);

create index if not exists pedagogical_change_log_entity_idx
  on public.pedagogical_change_log (entity_type, entity_id);

alter table public.programming_cells
  add column if not exists referentiel_ids jsonb not null default '[]'::jsonb;

alter table public.journal_entries
  add column if not exists referentiel_ids jsonb not null default '[]'::jsonb;

alter table public.pedagogical_change_log enable row level security;

drop policy if exists "pedagogical_change_log_all_anon" on public.pedagogical_change_log;
create policy "pedagogical_change_log_all_anon"
  on public.pedagogical_change_log for all to anon using (true) with check (true);
