-- Flora — Module Import intelligent des documents

create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null default '',
  original_filename text not null default '',
  document_type text not null default '',
  file_extension text not null default '',
  file_size bigint not null default 0,
  storage_path text not null default '',
  status text not null default 'uploaded',
  cycle text not null default '',
  niveau text not null default '',
  matiere text not null default '',
  sous_matiere text not null default '',
  methode text not null default '',
  auteur text not null default '',
  editeur text not null default '',
  annee text not null default '',
  resume text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

-- Schéma legacy : la table documents peut exister sans les colonnes Flora.
-- Ajout idempotent des colonnes manquantes avant les index et les tables liées.
alter table public.documents add column if not exists created_at timestamptz not null default now();
alter table public.documents add column if not exists title text not null default '';
alter table public.documents add column if not exists original_filename text not null default '';
alter table public.documents add column if not exists document_type text not null default '';
alter table public.documents add column if not exists file_extension text not null default '';
alter table public.documents add column if not exists file_size bigint not null default 0;
alter table public.documents add column if not exists storage_path text not null default '';
alter table public.documents add column if not exists status text not null default 'uploaded';
alter table public.documents add column if not exists cycle text not null default '';
alter table public.documents add column if not exists niveau text not null default '';
alter table public.documents add column if not exists matiere text not null default '';
alter table public.documents add column if not exists sous_matiere text not null default '';
alter table public.documents add column if not exists methode text not null default '';
alter table public.documents add column if not exists auteur text not null default '';
alter table public.documents add column if not exists editeur text not null default '';
alter table public.documents add column if not exists annee text not null default '';
alter table public.documents add column if not exists resume text not null default '';
alter table public.documents add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null default 0,
  title text not null default '',
  content text not null default '',
  page_start integer,
  page_end integer,
  section_type text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.document_chunks add column if not exists document_id uuid;
alter table public.document_chunks add column if not exists chunk_index integer not null default 0;
alter table public.document_chunks add column if not exists title text not null default '';
alter table public.document_chunks add column if not exists content text not null default '';
alter table public.document_chunks add column if not exists page_start integer;
alter table public.document_chunks add column if not exists page_end integer;
alter table public.document_chunks add column if not exists section_type text not null default '';
alter table public.document_chunks add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  tag text not null default ''
);

alter table public.document_tags add column if not exists document_id uuid;
alter table public.document_tags add column if not exists tag text not null default '';

create table if not exists public.document_competences (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  competence text not null default '',
  code_bo text not null default '',
  matiere text not null default '',
  sous_matiere text not null default '',
  niveau text not null default ''
);

alter table public.document_competences add column if not exists document_id uuid;
alter table public.document_competences add column if not exists competence text not null default '';
alter table public.document_competences add column if not exists code_bo text not null default '';
alter table public.document_competences add column if not exists matiere text not null default '';
alter table public.document_competences add column if not exists sous_matiere text not null default '';
alter table public.document_competences add column if not exists niveau text not null default '';

create table if not exists public.document_relations (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid not null references public.documents(id) on delete cascade,
  relation_type text not null default '',
  description text not null default ''
);

alter table public.document_relations add column if not exists source_document_id uuid;
alter table public.document_relations add column if not exists target_document_id uuid;
alter table public.document_relations add column if not exists relation_type text not null default '';
alter table public.document_relations add column if not exists description text not null default '';

-- Index créés uniquement si la colonne cible existe (compatible schéma legacy).
select public.flora_create_index_if_column_exists(
  'documents_status_idx',
  'documents',
  'status'
);
select public.flora_create_index_if_column_exists(
  'documents_matiere_idx',
  'documents',
  'matiere'
);
select public.flora_create_index_if_column_exists(
  'documents_document_type_idx',
  'documents',
  'document_type'
);
select public.flora_create_index_if_column_exists(
  'document_chunks_document_id_idx',
  'document_chunks',
  'document_id'
);
select public.flora_create_index_if_column_exists(
  'document_tags_document_id_idx',
  'document_tags',
  'document_id'
);
select public.flora_create_index_if_column_exists(
  'document_competences_document_id_idx',
  'document_competences',
  'document_id'
);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_tags enable row level security;
alter table public.document_competences enable row level security;
alter table public.document_relations enable row level security;

drop policy if exists "documents_select_anon" on public.documents;
drop policy if exists "documents_insert_anon" on public.documents;
drop policy if exists "documents_update_anon" on public.documents;
drop policy if exists "document_chunks_all_anon" on public.document_chunks;
drop policy if exists "document_tags_all_anon" on public.document_tags;
drop policy if exists "document_competences_all_anon" on public.document_competences;
drop policy if exists "document_relations_all_anon" on public.document_relations;

create policy "documents_select_anon"
  on public.documents for select to anon using (true);
create policy "documents_insert_anon"
  on public.documents for insert to anon with check (true);
create policy "documents_update_anon"
  on public.documents for update to anon using (true) with check (true);

create policy "document_chunks_all_anon"
  on public.document_chunks for all to anon using (true) with check (true);
create policy "document_tags_all_anon"
  on public.document_tags for all to anon using (true) with check (true);
create policy "document_competences_all_anon"
  on public.document_competences for all to anon using (true) with check (true);
create policy "document_relations_all_anon"
  on public.document_relations for all to anon using (true) with check (true);
