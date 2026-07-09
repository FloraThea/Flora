-- Flora — Affichage enrichi des créneaux EDT (couleur, dégradé, texte libre)

alter table public.timetable_slots add column if not exists custom_text text not null default '';
alter table public.timetable_slots add column if not exists color text not null default '';
alter table public.timetable_slots add column if not exists gradient text not null default '';

-- Rétrocompatibilité : remplir color depuis metadata.color si présent
update public.timetable_slots
set color = coalesce(nullif(color, ''), metadata->>'color', '')
where color = '' and metadata ? 'color';

update public.timetable_slots
set custom_text = coalesce(nullif(custom_text, ''), metadata->>'notes', '')
where custom_text = '' and metadata ? 'notes';

notify pgrst, 'reload schema';
