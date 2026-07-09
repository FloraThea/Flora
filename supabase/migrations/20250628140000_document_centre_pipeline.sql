-- Flora — Centre de ressources : pipeline documentaire robuste

alter table public.bo_documents add column if not exists document_type text not null default 'bo_officiel';
alter table public.bo_documents add column if not exists storage_url text not null default '';
alter table public.bo_documents add column if not exists error_message text not null default '';
alter table public.bo_documents add column if not exists original_name text not null default '';

update public.bo_documents
set original_name = original_filename
where original_name = '' and original_filename <> '';

update public.bo_documents
set status = upper(status)
where status in ('imported', 'analyzed', 'ready', 'error');

update public.bo_documents
set status = 'UPLOADED'
where status = 'IMPORTED';

update public.bo_documents
set status = 'ANALYZED'
where status = 'ANALYZED';

update public.bo_documents
set status = 'READY'
where status = 'READY';

update public.bo_documents
set status = 'ERROR'
where status = 'ERROR';

select public.flora_create_index_if_column_exists(
  'bo_documents_status_idx',
  'bo_documents',
  'status'
);

select public.flora_create_index_if_column_exists(
  'bo_documents_matiere_idx',
  'bo_documents',
  'matiere'
);
