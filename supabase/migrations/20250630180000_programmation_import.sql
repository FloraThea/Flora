-- Import et adaptation de programmations existantes

alter table public.programmations add column if not exists source_type text not null default 'generated';
alter table public.programmations add column if not exists source_storage_path text;
alter table public.programmations add column if not exists source_file_name text;
alter table public.programmations add column if not exists original_import jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists adapted_import jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists import_adaptation jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists format_config jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists competency_matches jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists discipline text;

create index if not exists programmations_source_type_idx
  on public.programmations (source_type);

create index if not exists programmations_school_year_status_idx
  on public.programmations (school_year, status);
