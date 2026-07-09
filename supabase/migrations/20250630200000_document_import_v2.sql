-- Flora — Import documentaire v2 (gros fichiers, chunks, file d'attente, versions)

-- Limite bucket Storage : 500 Mo (524288000 octets)
update storage.buckets
set file_size_limit = 524288000
where id = 'resources';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  524288000,
  array[
    'application/pdf',
    'application/octet-stream',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

-- Sessions d'upload par morceaux
create table if not exists public.document_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  original_filename text not null,
  content_type text not null default '',
  file_extension text not null default '',
  file_size bigint not null,
  chunk_size integer not null,
  total_chunks integer not null,
  uploaded_chunk_indexes integer[] not null default '{}'::integer[],
  storage_path text not null default '',
  document_id uuid references public.documents(id) on delete set null,
  status text not null default 'pending',
  file_checksum text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.document_upload_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.document_upload_sessions(id) on delete cascade,
  chunk_index integer not null,
  storage_path text not null,
  size bigint not null,
  checksum text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, chunk_index)
);

-- File d'attente d'analyse
create table if not exists public.document_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id) on delete cascade,
  session_id uuid references public.document_upload_sessions(id) on delete set null,
  status text not null default 'queued',
  queue_position integer not null default 0,
  progress integer not null default 0,
  stage_label text not null default '',
  error_message text not null default '',
  paused boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

-- Versions de documents
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null,
  storage_path text not null,
  file_size bigint not null default 0,
  original_filename text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

-- Segments enrichis (complète document_chunks pour l'indexation)
create table if not exists public.document_segments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  segment_index integer not null default 0,
  title text not null default '',
  content text not null default '',
  page_start integer,
  page_end integer,
  section_type text not null default '',
  chapter text not null default '',
  discipline text not null default '',
  niveau text not null default '',
  methode text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Notifications d'import
create table if not exists public.document_import_notifications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  job_id uuid references public.document_import_jobs(id) on delete cascade,
  notification_type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists document_upload_sessions_status_idx
  on public.document_upload_sessions (status);

create index if not exists document_import_jobs_status_queue_idx
  on public.document_import_jobs (status, queue_position);

create index if not exists document_versions_document_idx
  on public.document_versions (document_id, version_number desc);

create index if not exists document_segments_document_idx
  on public.document_segments (document_id, segment_index);

create index if not exists document_import_notifications_unread_idx
  on public.document_import_notifications (read, created_at desc);

alter table public.document_upload_sessions enable row level security;
alter table public.document_upload_chunks enable row level security;
alter table public.document_import_jobs enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_segments enable row level security;
alter table public.document_import_notifications enable row level security;

drop policy if exists "document_upload_sessions_all_anon" on public.document_upload_sessions;
drop policy if exists "document_upload_chunks_all_anon" on public.document_upload_chunks;
drop policy if exists "document_import_jobs_all_anon" on public.document_import_jobs;
drop policy if exists "document_versions_all_anon" on public.document_versions;
drop policy if exists "document_segments_all_anon" on public.document_segments;
drop policy if exists "document_import_notifications_all_anon" on public.document_import_notifications;

create policy "document_upload_sessions_all_anon"
  on public.document_upload_sessions for all to anon using (true) with check (true);
create policy "document_upload_chunks_all_anon"
  on public.document_upload_chunks for all to anon using (true) with check (true);
create policy "document_import_jobs_all_anon"
  on public.document_import_jobs for all to anon using (true) with check (true);
create policy "document_versions_all_anon"
  on public.document_versions for all to anon using (true) with check (true);
create policy "document_segments_all_anon"
  on public.document_segments for all to anon using (true) with check (true);
create policy "document_import_notifications_all_anon"
  on public.document_import_notifications for all to anon using (true) with check (true);
