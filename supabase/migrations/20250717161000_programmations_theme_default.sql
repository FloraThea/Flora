-- Colonne theme sur programmations (alignement prod / défaut vide)

alter table public.programmations add column if not exists theme text;
update public.programmations set theme = '' where theme is null;
alter table public.programmations alter column theme set default '';
alter table public.programmations alter column theme set not null;

notify pgrst, 'reload schema';
