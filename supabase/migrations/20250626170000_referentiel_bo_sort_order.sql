-- Flora — Ordre des compétences BO + niveau document source

alter table public.referentiels add column if not exists sort_order integer not null default 0;
alter table public.bo_documents add column if not exists niveau text not null default '';

select public.flora_create_index_if_column_exists(
  'referentiels_document_sort_idx',
  'referentiels',
  'document_source_id'
);
