-- Flora — Colonnes matière / onglets / corbeille : réconciliation complète idempotente
-- Garantit que toutes les tables pédagogiques exposent les champs attendus par le code.

-- ── programmations ──
alter table public.programmations add column if not exists matiere text not null default '';
alter table public.programmations add column if not exists sous_matiere text not null default '';
alter table public.programmations add column if not exists niveau text not null default '';
alter table public.programmations add column if not exists periode text not null default '';
alter table public.programmations add column if not exists theme text not null default '';
alter table public.programmations add column if not exists discipline text not null default '';
alter table public.programmations add column if not exists source_document jsonb not null default '{}'::jsonb;
alter table public.programmations add column if not exists deleted_at timestamptz;
alter table public.programmations add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.programmations add column if not exists deletion_reason text;
alter table public.programmations add column if not exists purge_after timestamptz;

-- ── progressions ──
alter table public.progressions add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.progressions add column if not exists matiere text not null default '';
alter table public.progressions add column if not exists sous_matiere text not null default '';
alter table public.progressions add column if not exists niveau text not null default '';
alter table public.progressions add column if not exists periode text not null default '';
alter table public.progressions add column if not exists link_mode text not null default 'linked';
alter table public.progressions add column if not exists source_document jsonb not null default '{}'::jsonb;
alter table public.progressions add column if not exists deleted_at timestamptz;
alter table public.progressions add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.progressions add column if not exists deletion_reason text;
alter table public.progressions add column if not exists purge_after timestamptz;

-- ── progression_tabs (onglets / couleur / ordre) ──
alter table public.progression_tabs add column if not exists subject_key text not null default '';
alter table public.progression_tabs add column if not exists subject_label text not null default '';
alter table public.progression_tabs add column if not exists sub_subject_label text not null default '';
alter table public.progression_tabs add column if not exists sort_order integer not null default 0;
alter table public.progression_tabs add column if not exists accent text not null default 'lavender';
alter table public.progression_tabs add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ── sequences ──
alter table public.sequences add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.sequences add column if not exists matiere text not null default '';
alter table public.sequences add column if not exists sous_matiere text not null default '';
alter table public.sequences add column if not exists niveau text not null default '';
alter table public.sequences add column if not exists link_mode text not null default 'linked';
alter table public.sequences add column if not exists deleted_at timestamptz;
alter table public.sequences add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.sequences add column if not exists deletion_reason text;
alter table public.sequences add column if not exists purge_after timestamptz;

-- ── seances ──
alter table public.seances add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.seances add column if not exists matiere text not null default '';
alter table public.seances add column if not exists sous_matiere text not null default '';
alter table public.seances add column if not exists niveau text not null default '';
alter table public.seances add column if not exists link_mode text not null default 'linked';
alter table public.seances add column if not exists deleted_at timestamptz;
alter table public.seances add column if not exists deleted_by uuid references public.teacher_profiles(id) on delete set null;
alter table public.seances add column if not exists deletion_reason text;
alter table public.seances add column if not exists purge_after timestamptz;

-- Backfill matière progression depuis le premier onglet si vide
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

-- Index utiles (idempotents)
create index if not exists progressions_active_matiere_idx
  on public.progressions (teacher_profile_id, matiere, sous_matiere)
  where deleted_at is null;

-- Recharger le cache PostgREST pour PGRST204
notify pgrst, 'reload schema';
