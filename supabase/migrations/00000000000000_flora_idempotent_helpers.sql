-- Flora — Helpers idempotents pour migrations sur bases existantes.
-- Fonctions utilitaires réutilisables par les migrations suivantes.

create or replace function public.flora_table_exists(p_table text)
returns boolean
language sql
stable
as $$
  select to_regclass(format('public.%I', p_table)) is not null;
$$;

create or replace function public.flora_column_exists(p_schema text, p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = p_schema
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function public.flora_column_exists(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select public.flora_column_exists('public', p_table, p_column);
$$;

create or replace function public.flora_create_index_if_column_exists(
  p_index_name text,
  p_table text,
  p_column text
)
returns void
language plpgsql
as $$
begin
  if public.flora_table_exists(p_table)
     and public.flora_column_exists(p_table, p_column) then
    execute format(
      'create index if not exists %I on public.%I(%I)',
      p_index_name,
      p_table,
      p_column
    );
  end if;
end;
$$;

create or replace function public.flora_create_index_if_columns_exist(
  p_index_name text,
  p_table text,
  p_columns text[]
)
returns void
language plpgsql
as $$
declare
  column_name text;
  columns_sql text := '';
begin
  if not public.flora_table_exists(p_table) then
    return;
  end if;

  foreach column_name in array p_columns loop
    if not public.flora_column_exists(p_table, column_name) then
      return;
    end if;
    if columns_sql <> '' then
      columns_sql := columns_sql || ', ';
    end if;
    columns_sql := columns_sql || format('%I', column_name);
  end loop;

  execute format(
    'create index if not exists %I on public.%I(%s)',
    p_index_name,
    p_table,
    columns_sql
  );
end;
$$;

create or replace function public.flora_create_unique_index_if_columns_exist(
  p_index_name text,
  p_table text,
  p_columns text[]
)
returns void
language plpgsql
as $$
declare
  column_name text;
  columns_sql text := '';
begin
  if not public.flora_table_exists(p_table) then
    return;
  end if;

  foreach column_name in array p_columns loop
    if not public.flora_column_exists(p_table, column_name) then
      return;
    end if;
    if columns_sql <> '' then
      columns_sql := columns_sql || ', ';
    end if;
    columns_sql := columns_sql || format('%I', column_name);
  end loop;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = p_table
      and indexname = p_index_name
  ) then
    execute format(
      'create unique index %I on public.%I(%s)',
      p_index_name,
      p_table,
      columns_sql
    );
  end if;
end;
$$;
