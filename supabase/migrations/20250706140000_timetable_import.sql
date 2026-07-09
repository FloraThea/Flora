-- Flora — Correspondances matières import emploi du temps (Excel → matières Flora)

create table if not exists public.subject_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade,
  raw_subject text not null,
  mapped_subject text not null,
  mapped_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_mappings_owner_check check (
    user_id is not null or teacher_profile_id is not null
  )
);

-- Migration depuis l'ancien schéma (source_label / canonical_subject)
do $$
begin
  if public.flora_column_exists('subject_mappings', 'source_label')
     and not public.flora_column_exists('subject_mappings', 'raw_subject') then
    alter table public.subject_mappings rename column source_label to raw_subject;
  end if;

  if public.flora_column_exists('subject_mappings', 'canonical_subject')
     and not public.flora_column_exists('subject_mappings', 'mapped_subject') then
    alter table public.subject_mappings rename column canonical_subject to mapped_subject;
  end if;
end $$;

alter table public.subject_mappings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.subject_mappings add column if not exists teacher_profile_id uuid references public.teacher_profiles(id) on delete cascade;
alter table public.subject_mappings add column if not exists raw_subject text;
alter table public.subject_mappings add column if not exists mapped_subject text;
alter table public.subject_mappings add column if not exists mapped_domain text;
alter table public.subject_mappings add column if not exists created_at timestamptz not null default now();
alter table public.subject_mappings add column if not exists updated_at timestamptz not null default now();

update public.subject_mappings set raw_subject = coalesce(raw_subject, '') where raw_subject is null;
update public.subject_mappings set mapped_subject = coalesce(mapped_subject, '') where mapped_subject is null;
update public.subject_mappings
set updated_at = coalesce(updated_at, now()),
    created_at = coalesce(created_at, now())
where updated_at is null or created_at is null;

alter table public.subject_mappings alter column raw_subject set not null;
alter table public.subject_mappings alter column mapped_subject set not null;

drop index if exists subject_mappings_teacher_raw_subject_key;
create unique index if not exists subject_mappings_teacher_raw_subject_key
  on public.subject_mappings (teacher_profile_id, raw_subject);

create unique index if not exists subject_mappings_user_raw_subject_key
  on public.subject_mappings (user_id, raw_subject)
  where user_id is not null;

create index if not exists subject_mappings_teacher_idx
  on public.subject_mappings (teacher_profile_id);

alter table public.subject_mappings enable row level security;

drop policy if exists subject_mappings_anon_all on public.subject_mappings;
create policy subject_mappings_anon_all on public.subject_mappings
  for all to anon using (true) with check (true);

-- sequence_sessions (hint PGRST205) — idempotent
do $$
begin
  if not public.flora_table_exists('sequence_sessions') then
    if public.flora_table_exists('sequences') then
      create table public.sequence_sessions (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        sequence_id uuid not null references public.sequences(id) on delete cascade,
        session_number integer not null default 1,
        title text not null default '',
        objectif text not null default '',
        duree_minutes integer not null default 45,
        ordre_pedagogique integer not null default 1,
        place_progression text not null default '',
        metadata jsonb not null default '{}'::jsonb
      );
    else
      create table public.sequence_sessions (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        sequence_id uuid,
        session_number integer not null default 1,
        title text not null default '',
        objectif text not null default '',
        duree_minutes integer not null default 45,
        ordre_pedagogique integer not null default 1,
        place_progression text not null default '',
        metadata jsonb not null default '{}'::jsonb
      );
    end if;
  end if;
end $$;

alter table public.sequence_sessions add column if not exists created_at timestamptz not null default now();
alter table public.sequence_sessions add column if not exists sequence_id uuid;
alter table public.sequence_sessions add column if not exists session_number integer not null default 1;
alter table public.sequence_sessions add column if not exists title text not null default '';
alter table public.sequence_sessions add column if not exists objectif text not null default '';
alter table public.sequence_sessions add column if not exists duree_minutes integer not null default 45;
alter table public.sequence_sessions add column if not exists ordre_pedagogique integer not null default 1;
alter table public.sequence_sessions add column if not exists place_progression text not null default '';
alter table public.sequence_sessions add column if not exists metadata jsonb not null default '{}'::jsonb;

select public.flora_create_index_if_column_exists(
  'sequence_sessions_sequence_id_idx',
  'sequence_sessions',
  'sequence_id'
);

alter table public.sequence_sessions enable row level security;

drop policy if exists "sequence_sessions_all_anon" on public.sequence_sessions;
create policy "sequence_sessions_all_anon"
  on public.sequence_sessions for all to anon using (true) with check (true);

-- Rafraîchir le cache schéma PostgREST / Supabase
notify pgrst, 'reload schema';
