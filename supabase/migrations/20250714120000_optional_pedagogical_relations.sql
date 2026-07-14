-- Relations pédagogiques facultatives : documents indépendants ou liés

-- Progressions sans programmation obligatoire
alter table public.progressions
  alter column programmation_id drop not null;

alter table public.progression_rows
  alter column programmation_id drop not null;

-- Séquences sans progression obligatoire
alter table public.sequences
  alter column progression_id drop not null;

alter table public.sequences
  alter column progression_row_id drop not null;

alter table public.sequences
  alter column programmation_id drop not null;

-- Séances sans séquence obligatoire
alter table public.seances
  alter column sequence_session_id drop not null;

alter table public.seances
  alter column sequence_id drop not null;

alter table public.seances
  alter column progression_id drop not null;

alter table public.seances
  alter column progression_row_id drop not null;

alter table public.seances
  alter column programmation_id drop not null;

-- Métadonnées de liaison explicite
alter table public.progressions
  add column if not exists link_mode text not null default 'linked';

alter table public.sequences
  add column if not exists link_mode text not null default 'linked';

alter table public.seances
  add column if not exists link_mode text not null default 'linked';

comment on column public.progressions.link_mode is 'linked | independent';
comment on column public.sequences.link_mode is 'linked | independent';
comment on column public.seances.link_mode is 'linked | independent';

-- Documents existants restent liés
update public.progressions
set link_mode = case when programmation_id is null then 'independent' else 'linked' end
where link_mode is distinct from case when programmation_id is null then 'independent' else 'linked' end;

update public.sequences
set link_mode = case
  when progression_id is null and progression_row_id is null then 'independent'
  else 'linked'
end
where link_mode is distinct from case
  when progression_id is null and progression_row_id is null then 'independent'
  else 'linked'
end;

update public.seances
set link_mode = case
  when sequence_id is null and sequence_session_id is null then 'independent'
  else 'linked'
end
where link_mode is distinct from case
  when sequence_id is null and sequence_session_id is null then 'independent'
  else 'linked'
end;
