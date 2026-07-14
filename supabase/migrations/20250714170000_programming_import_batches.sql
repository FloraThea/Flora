-- Lots d'import programmation multi-fichiers

create table if not exists public.programming_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  teacher_profile_id uuid not null,
  school_year text not null default '',
  document_type text not null default 'programming',
  status text not null default 'draft',
  merge_mode text not null default 'single_document',
  parsed_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb
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
  source_file_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists programming_import_batches_teacher_idx
  on public.programming_import_batches (teacher_profile_id, updated_at desc);

create index if not exists programming_import_files_batch_idx
  on public.programming_import_files (batch_id, page_order);

alter table public.programming_import_batches enable row level security;
alter table public.programming_import_files enable row level security;

drop policy if exists programming_import_batches_all_anon on public.programming_import_batches;
create policy programming_import_batches_all_anon on public.programming_import_batches
  for all to anon using (true) with check (true);

drop policy if exists programming_import_files_all_anon on public.programming_import_files;
create policy programming_import_files_all_anon on public.programming_import_files
  for all to anon using (true) with check (true);
