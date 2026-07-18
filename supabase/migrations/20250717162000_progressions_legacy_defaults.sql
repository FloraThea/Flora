-- Progressions : défauts sur colonnes legacy NOT NULL sans default

alter table public.progressions add column if not exists sequence_title text;
update public.progressions set sequence_title = '' where sequence_title is null;
alter table public.progressions alter column sequence_title set default '';
alter table public.progressions alter column sequence_title set not null;

alter table public.progressions add column if not exists seance_number integer;
update public.progressions set seance_number = 0 where seance_number is null;
alter table public.progressions alter column seance_number set default 0;

alter table public.progressions add column if not exists duree_minutes integer;
update public.progressions set duree_minutes = 0 where duree_minutes is null;
alter table public.progressions alter column duree_minutes set default 0;

alter table public.progressions add column if not exists objectif text;
update public.progressions set objectif = '' where objectif is null;
alter table public.progressions alter column objectif set default '';

alter table public.progressions add column if not exists fil_seance text;
update public.progressions set fil_seance = '' where fil_seance is null;
alter table public.progressions alter column fil_seance set default '';

alter table public.progressions add column if not exists materiel text;
update public.progressions set materiel = '' where materiel is null;
alter table public.progressions alter column materiel set default '';

alter table public.progressions add column if not exists ressources jsonb;
update public.progressions set ressources = '{}'::jsonb where ressources is null;
alter table public.progressions alter column ressources set default '{}'::jsonb;

alter table public.progressions add column if not exists statut text;
update public.progressions set statut = '' where statut is null;
alter table public.progressions alter column statut set default '';

notify pgrst, 'reload schema';
