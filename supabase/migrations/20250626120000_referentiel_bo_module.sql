-- Flora — Module Référentiel BO (programmes officiels)

create table if not exists public.referentiels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  niveau text not null default '',
  discipline text not null default '',
  domaine text,
  sous_domaine text,
  competence text not null default '',
  sous_competence text,
  code text,
  cycle text,
  source_document text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.referentiels add column if not exists created_at timestamptz not null default now();
alter table public.referentiels add column if not exists niveau text not null default '';
alter table public.referentiels add column if not exists discipline text not null default '';
alter table public.referentiels add column if not exists domaine text;
alter table public.referentiels add column if not exists sous_domaine text;
alter table public.referentiels add column if not exists competence text not null default '';
alter table public.referentiels add column if not exists sous_competence text;
alter table public.referentiels add column if not exists code text;
alter table public.referentiels add column if not exists cycle text;
alter table public.referentiels add column if not exists source_document text;
alter table public.referentiels add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'referentiels_discipline_idx',
  'referentiels',
  'discipline'
);
select public.flora_create_index_if_column_exists(
  'referentiels_niveau_idx',
  'referentiels',
  'niveau'
);
select public.flora_create_index_if_column_exists(
  'referentiels_code_idx',
  'referentiels',
  'code'
);

alter table public.referentiels enable row level security;

drop policy if exists "referentiels_all_anon" on public.referentiels;

create policy "referentiels_all_anon"
  on public.referentiels for all to anon using (true) with check (true);
