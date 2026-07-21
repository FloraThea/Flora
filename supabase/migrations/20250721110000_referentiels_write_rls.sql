-- Flora — Rétablir l'écriture sur referentiels (analyse Théa BO)

alter table public.referentiels enable row level security;

drop policy if exists referentiels_read on public.referentiels;
drop policy if exists referentiels_all on public.referentiels;
drop policy if exists referentiels_all_anon on public.referentiels;
drop policy if exists "referentiels_all_anon" on public.referentiels;

create policy referentiels_all on public.referentiels
  for all to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
