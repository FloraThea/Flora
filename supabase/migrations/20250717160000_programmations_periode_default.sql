-- Colonne periode sur programmations (alignement prod / défaut vide)

alter table public.programmations add column if not exists periode text;
update public.programmations set periode = '' where periode is null;
alter table public.programmations alter column periode set default '';
alter table public.programmations alter column periode set not null;

notify pgrst, 'reload schema';
