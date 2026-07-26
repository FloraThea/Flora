-- Flora — Feedback d'association compétences BO (apprentissage des préférences enseignant)

create table if not exists public.competence_association_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  content_hash text not null,
  matiere text,
  niveau text,
  methode text,
  proposed_referentiel_id uuid,
  final_referentiel_id uuid,
  action text not null check (action in ('accepted', 'rejected', 'replaced', 'added', 'removed')),
  confidence numeric(4, 3),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists competence_association_feedback_teacher_idx
  on public.competence_association_feedback(teacher_profile_id);

create index if not exists competence_association_feedback_hash_idx
  on public.competence_association_feedback(content_hash);

create index if not exists competence_association_feedback_referentiel_idx
  on public.competence_association_feedback(final_referentiel_id);

alter table public.competence_association_feedback enable row level security;

drop policy if exists competence_association_feedback_tenant on public.competence_association_feedback;

create policy competence_association_feedback_tenant on public.competence_association_feedback
  for all to anon, authenticated
  using (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  )
  with check (
    teacher_profile_id is not null
    and public.flora_can_access_profile(teacher_profile_id)
  );
