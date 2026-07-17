-- Réconciliation idempotente du schéma Flora ↔ code applicatif
-- Applique les colonnes et contraintes attendues par le code sans perte de données.

-- Surcharge 3 arguments (schéma explicite) — idempotente via CREATE OR REPLACE
create or replace function public.flora_column_exists(p_schema text, p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = p_schema
      and table_name = p_table
      and column_name = p_column
  );
$$;

-- Relations pédagogiques facultatives (reprise sûre de 20250714120000)
do $$
begin
  if public.flora_column_exists('public', 'progressions', 'programmation_id') then
    alter table public.progressions alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'progression_rows', 'programmation_id') then
    alter table public.progression_rows alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'progression_id') then
    alter table public.sequences alter column progression_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'progression_row_id') then
    alter table public.sequences alter column progression_row_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'programmation_id') then
    alter table public.sequences alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'sequence_session_id') then
    alter table public.seances alter column sequence_session_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'sequence_id') then
    alter table public.seances alter column sequence_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'progression_id') then
    alter table public.seances alter column progression_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'progression_row_id') then
    alter table public.seances alter column progression_row_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'programmation_id') then
    alter table public.seances alter column programmation_id drop not null;
  end if;
end $$;

alter table public.progressions add column if not exists link_mode text not null default 'linked';
alter table public.sequences add column if not exists link_mode text not null default 'linked';
alter table public.seances add column if not exists link_mode text not null default 'linked';

comment on column public.progressions.link_mode is 'linked | independent';
comment on column public.sequences.link_mode is 'linked | independent';
comment on column public.seances.link_mode is 'linked | independent';

-- Lots d''import programmation (reprise sûre si migration 20250714170000 absente)
create table if not exists public.programming_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid not null,
  school_year text not null default '',
  status text not null default 'draft',
  merge_mode text not null default 'single_document',
  parsed_snapshot jsonb
);

create table if not exists public.programming_import_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  batch_id uuid not null references public.programming_import_batches(id) on delete cascade,
  page_order integer not null default 1,
  filename text not null default '',
  mime_type text not null default '',
  storage_path text not null default '',
  file_size_bytes bigint not null default 0,
  analysis_status text not null default 'pending',
  analysis_error text not null default '',
  parsed_snapshot jsonb,
  pdf_page_number integer,
  source_file_id uuid
);

alter table public.programming_import_batches enable row level security;
alter table public.programming_import_files enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'programming_import_batches' and policyname = 'programming_import_batches_all_anon'
  ) then
    create policy programming_import_batches_all_anon on public.programming_import_batches
      for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'programming_import_files' and policyname = 'programming_import_files_all_anon'
  ) then
    create policy programming_import_files_all_anon on public.programming_import_files
      for all to anon using (true) with check (true);
  end if;
end $$;

-- Rafraîchir le cache PostgREST après modifications de schéma
notify pgrst, 'reload schema';
