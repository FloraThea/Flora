-- Flora — Forcer la limite du bucket « resources » à 500 Mo (524288000 octets)
--
-- Contexte : l'import pédagogique accepte des PDF jusqu'à 500 Mo.
-- Si cette migration n'est pas appliquée, Supabase renvoie :
--   "The object exceeded the maximum allowed size"
--
-- Application :
--   npx supabase db push
--
-- Vérification manuelle (Dashboard Supabase → Storage → resources → Settings) :
--   File size limit = 524288000 (500 Mo)

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
set file_size_limit = 524288000;
