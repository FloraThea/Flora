-- Flora — Rétablir l'écriture sur bo_documents (import référentiel BO)

alter table public.bo_documents enable row level security;

drop policy if exists bo_documents_read on public.bo_documents;
drop policy if exists bo_documents_all on public.bo_documents;
drop policy if exists bo_documents_all_anon on public.bo_documents;
drop policy if exists "bo_documents_all_anon" on public.bo_documents;

create policy bo_documents_all on public.bo_documents
  for all to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
