-- Flora — Unification Bibliothèque / Référentiel BO (catégories documentaires)

alter table public.documents add column if not exists library_category text not null default '';

update public.documents
set library_category = case
  when lower(document_type) in ('bo', 'bulletin officiel') then 'Référentiel BO'
  when lower(document_type) in ('guide du maître', 'manuel') then 'Guide enseignant'
  when lower(document_type) = 'programmation' then 'Programmation'
  when lower(document_type) = 'progression' then 'Progression'
  when lower(document_type) in ('séquence', 'seance', 'séance') then 'Séquence'
  when lower(document_type) = 'cahier journal' then 'Cahier journal'
  when lower(document_type) = 'ressource personnelle' then 'Personnel'
  else coalesce(nullif(library_category, ''), 'Ressource pédagogique')
end
where library_category = '';

comment on column public.documents.library_category is
  'Catégorie unifiée Bibliothèque Flora (Référentiel BO, Guide enseignant, etc.)';

comment on table public.bo_documents is
  'Documents référentiels BO — exposés dans la Bibliothèque avec la catégorie Référentiel BO';

notify pgrst, 'reload schema';
