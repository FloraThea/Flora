-- Corbeille pour les documents de la bibliothèque
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.documents add column if not exists deleted_by uuid references public.teacher_profiles(id);
alter table public.documents add column if not exists deletion_reason text;
alter table public.documents add column if not exists purge_after timestamptz;

create index if not exists documents_active_idx
  on public.documents (teacher_profile_id, created_at desc)
  where deleted_at is null;

create index if not exists documents_trash_idx
  on public.documents (teacher_profile_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists documents_purge_after_idx
  on public.documents (purge_after)
  where deleted_at is not null and purge_after is not null;
