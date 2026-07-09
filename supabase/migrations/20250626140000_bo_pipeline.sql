-- Flora — Pipeline BO complet (document source + compétences liées)

create table if not exists public.bo_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  original_filename text not null default '',
  storage_path text not null default '',
  file_extension text not null default '',
  file_size bigint not null default 0,
  cycle text not null default '',
  matiere text not null default '',
  domaine text not null default '',
  extracted_text text not null default '',
  text_length integer not null default 0,
  page_count integer,
  extraction_method text not null default '',
  status text not null default 'imported',
  active_for_programmation boolean not null default false,
  validation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.bo_documents add column if not exists created_at timestamptz not null default now();
alter table public.bo_documents add column if not exists updated_at timestamptz not null default now();
alter table public.bo_documents add column if not exists original_filename text not null default '';
alter table public.bo_documents add column if not exists storage_path text not null default '';
alter table public.bo_documents add column if not exists file_extension text not null default '';
alter table public.bo_documents add column if not exists file_size bigint not null default 0;
alter table public.bo_documents add column if not exists cycle text not null default '';
alter table public.bo_documents add column if not exists matiere text not null default '';
alter table public.bo_documents add column if not exists domaine text not null default '';
alter table public.bo_documents add column if not exists extracted_text text not null default '';
alter table public.bo_documents add column if not exists text_length integer not null default 0;
alter table public.bo_documents add column if not exists page_count integer;
alter table public.bo_documents add column if not exists extraction_method text not null default '';
alter table public.bo_documents add column if not exists status text not null default 'imported';
alter table public.bo_documents add column if not exists active_for_programmation boolean not null default false;
alter table public.bo_documents add column if not exists validation jsonb not null default '{}'::jsonb;
alter table public.bo_documents add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.referentiels add column if not exists document_source_id uuid;
alter table public.referentiels add column if not exists section text;
alter table public.referentiels add column if not exists source_excerpt text;
alter table public.referentiels add column if not exists competence_type text;

select public.flora_create_index_if_column_exists(
  'bo_documents_matiere_idx',
  'bo_documents',
  'matiere'
);
select public.flora_create_index_if_column_exists(
  'bo_documents_status_idx',
  'bo_documents',
  'status'
);
select public.flora_create_index_if_column_exists(
  'bo_documents_active_idx',
  'bo_documents',
  'active_for_programmation'
);
select public.flora_create_index_if_column_exists(
  'referentiels_document_source_id_idx',
  'referentiels',
  'document_source_id'
);
select public.flora_create_index_if_column_exists(
  'referentiels_section_idx',
  'referentiels',
  'section'
);

alter table public.bo_documents enable row level security;

drop policy if exists "bo_documents_all_anon" on public.bo_documents;

create policy "bo_documents_all_anon"
  on public.bo_documents for all to anon using (true) with check (true);
