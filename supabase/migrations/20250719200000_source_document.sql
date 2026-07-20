-- Copie fidèle du document importé (Parts 22–37)

alter table public.programmations
  add column if not exists source_document jsonb not null default '{}'::jsonb;

alter table public.progressions
  add column if not exists source_document jsonb not null default '{}'::jsonb;

comment on column public.programmations.source_document is
  'Représentation fidèle du fichier importé (feuilles, cellules, fusions, styles).';

comment on column public.progressions.source_document is
  'Représentation fidèle du fichier importé (feuilles, cellules, fusions, styles).';
