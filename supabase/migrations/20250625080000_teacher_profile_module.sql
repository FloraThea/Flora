-- Flora — Module 0 : Profil pédagogique intelligent

create table if not exists public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nom text not null default '',
  prenom text not null default '',
  ecole_nom text not null default '',
  commune text not null default '',
  academie text not null default '',
  zone_scolaire text not null default 'A',
  pays text not null default 'France',
  school_year text not null default '',
  levels text[] not null default '{}'::text[],
  student_count integer not null default 0,
  class_type text not null default 'simple',
  ulis boolean not null default false,
  segpa boolean not null default false,
  rep boolean not null default false,
  rep_plus boolean not null default false,
  timetables jsonb not null default '[]'::jsonb,
  default_timetable_id text not null default '',
  personalization jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.teacher_profiles add column if not exists created_at timestamptz not null default now();
alter table public.teacher_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.teacher_profiles add column if not exists nom text not null default '';
alter table public.teacher_profiles add column if not exists prenom text not null default '';
alter table public.teacher_profiles add column if not exists ecole_nom text not null default '';
alter table public.teacher_profiles add column if not exists commune text not null default '';
alter table public.teacher_profiles add column if not exists academie text not null default '';
alter table public.teacher_profiles add column if not exists zone_scolaire text not null default 'A';
alter table public.teacher_profiles add column if not exists pays text not null default 'France';
alter table public.teacher_profiles add column if not exists school_year text not null default '';
alter table public.teacher_profiles add column if not exists levels text[] not null default '{}'::text[];
alter table public.teacher_profiles add column if not exists student_count integer not null default 0;
alter table public.teacher_profiles add column if not exists class_type text not null default 'simple';
alter table public.teacher_profiles add column if not exists ulis boolean not null default false;
alter table public.teacher_profiles add column if not exists segpa boolean not null default false;
alter table public.teacher_profiles add column if not exists rep boolean not null default false;
alter table public.teacher_profiles add column if not exists rep_plus boolean not null default false;
alter table public.teacher_profiles add column if not exists timetables jsonb not null default '[]'::jsonb;
alter table public.teacher_profiles add column if not exists default_timetable_id text not null default '';
alter table public.teacher_profiles add column if not exists personalization jsonb not null default '{}'::jsonb;
alter table public.teacher_profiles add column if not exists status text not null default 'draft';
alter table public.teacher_profiles add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile_id uuid not null references public.teacher_profiles(id) on delete cascade,
  pedagogy_styles text[] not null default '{}'::text[],
  resource_priorities text[] not null default '{}'::text[],
  ai_detail_level text not null default 'moyen',
  ai_tone text not null default 'simple',
  ai_generation_type text not null default 'equilibree',
  export_formats text[] not null default '{word,pdf}'::text[],
  export_order text[] not null default '{word,pdf,excel}'::text[]
);

alter table public.teacher_preferences add column if not exists created_at timestamptz not null default now();
alter table public.teacher_preferences add column if not exists updated_at timestamptz not null default now();
alter table public.teacher_preferences add column if not exists profile_id uuid;
alter table public.teacher_preferences add column if not exists pedagogy_styles text[] not null default '{}'::text[];
alter table public.teacher_preferences add column if not exists resource_priorities text[] not null default '{}'::text[];
alter table public.teacher_preferences add column if not exists ai_detail_level text not null default 'moyen';
alter table public.teacher_preferences add column if not exists ai_tone text not null default 'simple';
alter table public.teacher_preferences add column if not exists ai_generation_type text not null default 'equilibree';
alter table public.teacher_preferences add column if not exists export_formats text[] not null default '{word,pdf}'::text[];
alter table public.teacher_preferences add column if not exists export_order text[] not null default '{word,pdf,excel}'::text[];

create table if not exists public.teacher_methods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.teacher_profiles(id) on delete cascade,
  method_name text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0
);

alter table public.teacher_methods add column if not exists created_at timestamptz not null default now();
alter table public.teacher_methods add column if not exists profile_id uuid;
alter table public.teacher_methods add column if not exists method_name text not null default '';
alter table public.teacher_methods add column if not exists is_primary boolean not null default false;
alter table public.teacher_methods add column if not exists sort_order integer not null default 0;

create table if not exists public.teacher_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.teacher_profiles(id) on delete cascade,
  project_type text not null default 'annuel',
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0
);

alter table public.teacher_projects add column if not exists created_at timestamptz not null default now();
alter table public.teacher_projects add column if not exists profile_id uuid;
alter table public.teacher_projects add column if not exists project_type text not null default 'annuel';
alter table public.teacher_projects add column if not exists title text not null default '';
alter table public.teacher_projects add column if not exists description text not null default '';
alter table public.teacher_projects add column if not exists sort_order integer not null default 0;

select public.flora_create_unique_index_if_columns_exist(
  'teacher_preferences_profile_id_idx',
  'teacher_preferences',
  array['profile_id']
);
select public.flora_create_index_if_column_exists(
  'teacher_methods_profile_id_idx',
  'teacher_methods',
  'profile_id'
);
select public.flora_create_index_if_column_exists(
  'teacher_projects_profile_id_idx',
  'teacher_projects',
  'profile_id'
);

alter table public.teacher_profiles enable row level security;
alter table public.teacher_preferences enable row level security;
alter table public.teacher_methods enable row level security;
alter table public.teacher_projects enable row level security;

drop policy if exists "teacher_profiles_all_anon" on public.teacher_profiles;
drop policy if exists "teacher_preferences_all_anon" on public.teacher_preferences;
drop policy if exists "teacher_methods_all_anon" on public.teacher_methods;
drop policy if exists "teacher_projects_all_anon" on public.teacher_projects;

create policy "teacher_profiles_all_anon"
  on public.teacher_profiles for all to anon using (true) with check (true);
create policy "teacher_preferences_all_anon"
  on public.teacher_preferences for all to anon using (true) with check (true);
create policy "teacher_methods_all_anon"
  on public.teacher_methods for all to anon using (true) with check (true);
create policy "teacher_projects_all_anon"
  on public.teacher_projects for all to anon using (true) with check (true);
