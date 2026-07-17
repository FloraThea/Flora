-- Flora — Stabilisation architecture : tenant, RLS, relations facultatives, index

-- Lien profil ↔ auth (prépare multi-utilisateur)
alter table public.teacher_profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists teacher_profiles_user_id_idx
  on public.teacher_profiles(user_id)
  where user_id is not null;

-- Colonne tenant sur tables pédagogiques privées
alter table public.programmations add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.progressions add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.sequences add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.documents add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;

create index if not exists programmations_teacher_profile_id_idx on public.programmations(teacher_profile_id);
create index if not exists programmations_teacher_school_year_idx on public.programmations(teacher_profile_id, school_year);
create index if not exists progressions_teacher_profile_id_idx on public.progressions(teacher_profile_id);
create index if not exists sequences_teacher_profile_id_idx on public.sequences(teacher_profile_id);
create index if not exists documents_teacher_profile_id_idx on public.documents(teacher_profile_id);
create index if not exists timetable_schedules_teacher_active_idx on public.timetable_schedules(teacher_profile_id, is_active);
create index if not exists journals_teacher_date_idx on public.journals(teacher_profile_id, journal_date);

-- Backfill : rattacher les données orphelines au profil le plus ancien
do $$
declare
  default_profile uuid;
begin
  select id into default_profile from public.teacher_profiles order by created_at asc limit 1;
  if default_profile is null then
    return;
  end if;

  update public.programmations set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.progressions set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.sequences set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.documents set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.timetable_schedules set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.journals set teacher_profile_id = default_profile where teacher_profile_id is null;
  update public.seances set teacher_profile_id = default_profile where teacher_profile_id is null;
end $$;

-- Relations pédagogiques facultatives (idempotent)
do $$
begin
  if public.flora_column_exists('public', 'progressions', 'programmation_id') then
    alter table public.progressions alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'progression_rows', 'programmation_id') then
    alter table public.progression_rows alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'progression_id') then
    alter table public.sequences alter column progression_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'progression_row_id') then
    alter table public.sequences alter column progression_row_id drop not null;
  end if;
  if public.flora_column_exists('public', 'sequences', 'programmation_id') then
    alter table public.sequences alter column programmation_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'sequence_session_id') then
    alter table public.seances alter column sequence_session_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'sequence_id') then
    alter table public.seances alter column sequence_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'progression_id') then
    alter table public.seances alter column progression_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'progression_row_id') then
    alter table public.seances alter column progression_row_id drop not null;
  end if;
  if public.flora_column_exists('public', 'seances', 'programmation_id') then
    alter table public.seances alter column programmation_id drop not null;
  end if;
end $$;

alter table public.progressions add column if not exists link_mode text not null default 'linked';
alter table public.sequences add column if not exists link_mode text not null default 'linked';
alter table public.seances add column if not exists link_mode text not null default 'linked';

-- Profils accessibles (auth ou single-tenant contrôlé)
create or replace function public.flora_accessible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.teacher_profiles
  where user_id is not distinct from auth.uid()
     or (
       auth.uid() is null
       and id = (select tp.id from public.teacher_profiles tp order by tp.created_at asc limit 1)
     );
$$;

create or replace function public.flora_can_access_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile_id in (select public.flora_accessible_profile_ids());
$$;

-- RLS tenant : programmations
alter table public.programmations enable row level security;
drop policy if exists programmations_all_anon on public.programmations;
drop policy if exists programmations_tenant on public.programmations;
create policy programmations_tenant on public.programmations
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : progressions
alter table public.progressions enable row level security;
drop policy if exists progressions_all_anon on public.progressions;
drop policy if exists progressions_tenant on public.progressions;
create policy progressions_tenant on public.progressions
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : sequences
alter table public.sequences enable row level security;
drop policy if exists sequences_all_anon on public.sequences;
drop policy if exists sequences_tenant on public.sequences;
create policy sequences_tenant on public.sequences
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : documents
alter table public.documents enable row level security;
drop policy if exists documents_select_anon on public.documents;
drop policy if exists documents_insert_anon on public.documents;
drop policy if exists documents_update_anon on public.documents;
drop policy if exists documents_tenant on public.documents;
create policy documents_tenant on public.documents
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : emploi du temps
alter table public.timetable_schedules enable row level security;
drop policy if exists timetable_schedules_all_anon on public.timetable_schedules;
drop policy if exists timetable_schedules_tenant on public.timetable_schedules;
create policy timetable_schedules_tenant on public.timetable_schedules
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : cahier journal
alter table public.journals enable row level security;
drop policy if exists journals_all_anon on public.journals;
drop policy if exists journals_tenant on public.journals;
create policy journals_tenant on public.journals
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- RLS tenant : séances
alter table public.seances enable row level security;
drop policy if exists seances_all_anon on public.seances;
drop policy if exists seances_tenant on public.seances;
create policy seances_tenant on public.seances
  for all to anon, authenticated
  using (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id))
  with check (teacher_profile_id is not null and public.flora_can_access_profile(teacher_profile_id));

-- Déprécier le JSON profil (conservé pour migration, non source de vérité)
comment on column public.teacher_profiles.timetables is 'DEPRECATED — source EDT : timetable_schedules + timetable_slots';

notify pgrst, 'reload schema';
