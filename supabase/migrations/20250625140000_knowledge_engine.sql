-- Flora — Module 2 : Moteur de ressources intelligentes

create table if not exists public.pedagogical_entities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  entity_type text not null default '',
  label text not null default '',
  content text not null default '',
  source_text text not null default '',
  confidence numeric(5,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.pedagogical_entities add column if not exists created_at timestamptz not null default now();
alter table public.pedagogical_entities add column if not exists document_id uuid;
alter table public.pedagogical_entities add column if not exists chunk_id uuid;
alter table public.pedagogical_entities add column if not exists entity_type text not null default '';
alter table public.pedagogical_entities add column if not exists label text not null default '';
alter table public.pedagogical_entities add column if not exists content text not null default '';
alter table public.pedagogical_entities add column if not exists source_text text not null default '';
alter table public.pedagogical_entities add column if not exists confidence numeric(5,4) not null default 0;
alter table public.pedagogical_entities add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.pedagogical_relations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id) on delete cascade,
  source_entity_id uuid not null references public.pedagogical_entities(id) on delete cascade,
  target_entity_id uuid not null references public.pedagogical_entities(id) on delete cascade,
  relation_type text not null default '',
  confidence numeric(5,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.pedagogical_relations add column if not exists created_at timestamptz not null default now();
alter table public.pedagogical_relations add column if not exists document_id uuid;
alter table public.pedagogical_relations add column if not exists source_entity_id uuid;
alter table public.pedagogical_relations add column if not exists target_entity_id uuid;
alter table public.pedagogical_relations add column if not exists relation_type text not null default '';
alter table public.pedagogical_relations add column if not exists confidence numeric(5,4) not null default 0;
alter table public.pedagogical_relations add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.knowledge_index (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_id uuid references public.pedagogical_entities(id) on delete cascade,
  chunk_id uuid references public.document_chunks(id) on delete cascade,
  term text not null default '',
  normalized_term text not null default '',
  category text not null default '',
  weight numeric(6,3) not null default 1,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.knowledge_index add column if not exists created_at timestamptz not null default now();
alter table public.knowledge_index add column if not exists document_id uuid;
alter table public.knowledge_index add column if not exists entity_id uuid;
alter table public.knowledge_index add column if not exists chunk_id uuid;
alter table public.knowledge_index add column if not exists term text not null default '';
alter table public.knowledge_index add column if not exists normalized_term text not null default '';
alter table public.knowledge_index add column if not exists category text not null default '';
alter table public.knowledge_index add column if not exists weight numeric(6,3) not null default 1;
alter table public.knowledge_index add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.bo_competence_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_id uuid references public.pedagogical_entities(id) on delete set null,
  document_competence_id uuid references public.document_competences(id) on delete set null,
  referentiel_id uuid,
  matched_label text not null default '',
  confidence numeric(5,4) not null default 0,
  match_method text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.bo_competence_links add column if not exists created_at timestamptz not null default now();
alter table public.bo_competence_links add column if not exists document_id uuid;
alter table public.bo_competence_links add column if not exists entity_id uuid;
alter table public.bo_competence_links add column if not exists document_competence_id uuid;
alter table public.bo_competence_links add column if not exists referentiel_id uuid;
alter table public.bo_competence_links add column if not exists matched_label text not null default '';
alter table public.bo_competence_links add column if not exists confidence numeric(5,4) not null default 0;
alter table public.bo_competence_links add column if not exists match_method text not null default '';
alter table public.bo_competence_links add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'pedagogical_entities_document_id_idx',
  'pedagogical_entities',
  'document_id'
);
select public.flora_create_index_if_column_exists(
  'pedagogical_entities_type_idx',
  'pedagogical_entities',
  'entity_type'
);
select public.flora_create_index_if_column_exists(
  'pedagogical_relations_document_id_idx',
  'pedagogical_relations',
  'document_id'
);
select public.flora_create_index_if_column_exists(
  'knowledge_index_document_id_idx',
  'knowledge_index',
  'document_id'
);
select public.flora_create_index_if_column_exists(
  'knowledge_index_normalized_term_idx',
  'knowledge_index',
  'normalized_term'
);
select public.flora_create_index_if_column_exists(
  'knowledge_index_category_idx',
  'knowledge_index',
  'category'
);
select public.flora_create_index_if_column_exists(
  'bo_competence_links_document_id_idx',
  'bo_competence_links',
  'document_id'
);

alter table public.pedagogical_entities enable row level security;
alter table public.pedagogical_relations enable row level security;
alter table public.knowledge_index enable row level security;
alter table public.bo_competence_links enable row level security;

drop policy if exists "pedagogical_entities_all_anon" on public.pedagogical_entities;
drop policy if exists "pedagogical_relations_all_anon" on public.pedagogical_relations;
drop policy if exists "knowledge_index_all_anon" on public.knowledge_index;
drop policy if exists "bo_competence_links_all_anon" on public.bo_competence_links;

create policy "pedagogical_entities_all_anon"
  on public.pedagogical_entities for all to anon using (true) with check (true);
create policy "pedagogical_relations_all_anon"
  on public.pedagogical_relations for all to anon using (true) with check (true);
create policy "knowledge_index_all_anon"
  on public.knowledge_index for all to anon using (true) with check (true);
create policy "bo_competence_links_all_anon"
  on public.bo_competence_links for all to anon using (true) with check (true);
