-- Corbeille (soft delete) + matières sur progressions

-- Colonnes communes de corbeille
alter table public.programmations add column if not exists deleted_at timestamptz;
alter table public.programmations add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.programmations add column if not exists deletion_reason text;
alter table public.programmations add column if not exists purge_after timestamptz;

alter table public.progressions add column if not exists deleted_at timestamptz;
alter table public.progressions add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.progressions add column if not exists deletion_reason text;
alter table public.progressions add column if not exists purge_after timestamptz;

alter table public.sequences add column if not exists deleted_at timestamptz;
alter table public.sequences add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.sequences add column if not exists deletion_reason text;
alter table public.sequences add column if not exists purge_after timestamptz;

alter table public.seances add column if not exists deleted_at timestamptz;
alter table public.seances add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.seances add column if not exists deletion_reason text;
alter table public.seances add column if not exists purge_after timestamptz;

-- Matière au niveau progression (source de vérité complémentaire aux onglets)
alter table public.progressions add column if not exists matiere text not null default '';
alter table public.progressions add column if not exists sous_matiere text not null default '';
alter table public.progressions add column if not exists niveau text not null default '';
alter table public.progressions add column if not exists periode text not null default '';

-- Sous-matière explicite sur programmations (discipline reste disponible)
alter table public.programmations add column if not exists sous_matiere text not null default '';

-- Migration des données existantes : matière depuis le premier onglet
update public.progressions p
set
  matiere = coalesce(nullif(t.subject_label, ''), p.matiere, ''),
  sous_matiere = coalesce(nullif(t.sub_subject_label, ''), p.sous_matiere, '')
from (
  select distinct on (progression_id)
    progression_id,
    subject_label,
    sub_subject_label
  from public.progression_tabs
  order by progression_id, sort_order, created_at
) t
where p.id = t.progression_id
  and (coalesce(p.matiere, '') = '' or coalesce(p.sous_matiere, '') = '');

-- Conjugaison → Français / Conjugaison si détectable dans le titre ou l'onglet
update public.progressions
set
  matiere = case
    when coalesce(matiere, '') <> '' then matiere
    when title ilike '%conjugaison%' or sous_matiere ilike '%conjugaison%' then 'Français'
    else matiere
  end,
  sous_matiere = case
    when coalesce(sous_matiere, '') <> '' then sous_matiere
    when title ilike '%conjugaison%' or sous_matiere ilike '%conjugaison%' then 'Conjugaison'
    else sous_matiere
  end
where coalesce(matiere, '') = '' or coalesce(sous_matiere, '') = '';

update public.programmations
set sous_matiere = coalesce(nullif(discipline, ''), nullif(theme, ''), sous_matiere, '')
where coalesce(sous_matiere, '') = '';

-- Index actifs (listes normales)
create index if not exists programmations_active_profile_idx
  on public.programmations (teacher_profile_id, created_at desc)
  where deleted_at is null;

create index if not exists progressions_active_profile_idx
  on public.progressions (teacher_profile_id, created_at desc)
  where deleted_at is null;

create index if not exists progressions_active_matiere_idx
  on public.progressions (teacher_profile_id, matiere, sous_matiere)
  where deleted_at is null;

create index if not exists sequences_active_profile_idx
  on public.sequences (teacher_profile_id, created_at desc)
  where deleted_at is null;

create index if not exists seances_active_profile_idx
  on public.seances (teacher_profile_id, created_at desc)
  where deleted_at is null;

-- Index corbeille
create index if not exists programmations_trash_idx
  on public.programmations (teacher_profile_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists progressions_trash_idx
  on public.progressions (teacher_profile_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists sequences_trash_idx
  on public.sequences (teacher_profile_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists seances_trash_idx
  on public.seances (teacher_profile_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists programmations_purge_after_idx
  on public.programmations (purge_after)
  where deleted_at is not null and purge_after is not null;

create index if not exists progressions_purge_after_idx
  on public.progressions (purge_after)
  where deleted_at is not null and purge_after is not null;

create index if not exists sequences_purge_after_idx
  on public.sequences (purge_after)
  where deleted_at is not null and purge_after is not null;

create index if not exists seances_purge_after_idx
  on public.seances (purge_after)
  where deleted_at is not null and purge_after is not null;

comment on column public.programmations.deleted_at is 'Corbeille : non null = élément supprimé logiquement';
comment on column public.progressions.matiere is 'Matière validée par l''utilisateur (source de vérité module)';
