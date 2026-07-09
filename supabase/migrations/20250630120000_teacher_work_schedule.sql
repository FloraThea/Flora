-- Flora — Quotité de travail et jours travaillés (profil enseignant)

alter table public.teacher_profiles
  add column if not exists work_quota_percentage integer not null default 100;

alter table public.teacher_profiles
  add column if not exists work_quota_label text not null default '100 %';

alter table public.teacher_profiles
  add column if not exists working_days text[] not null default array['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']::text[];

update public.teacher_profiles
set work_quota_label = '100 %'
where work_quota_label = '' or work_quota_label is null;

update public.teacher_profiles
set work_quota_percentage = 100
where work_quota_percentage is null or work_quota_percentage <= 0;

select public.flora_create_index_if_column_exists(
  'teacher_profiles_work_quota_idx',
  'teacher_profiles',
  'work_quota_percentage'
);
