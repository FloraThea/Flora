import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingSchemaColumnError(
  error: PostgrestError | null | undefined,
  columnName: string,
): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST204" &&
    (error.message.includes(`'${columnName}'`) || error.message.includes(columnName))
  );
}

export function omitRecordKey<T extends Record<string, unknown>>(
  row: T,
  key: keyof T,
): Omit<T, typeof key> {
  const next = { ...row };
  delete next[key];
  return next;
}

export async function insertWithOptionalColumnFallback<T extends Record<string, unknown>, R>(
  insertFn: (row: T) => PromiseLike<{ data: R | null; error: PostgrestError | null }>,
  row: T,
  optionalColumn: keyof T,
): Promise<{ data: R | null; error: PostgrestError | null }> {
  const first = await insertFn(row);
  if (!first.error || !isMissingSchemaColumnError(first.error, String(optionalColumn))) {
    return first;
  }

  console.warn(
    `[schema-compat] Column "${String(optionalColumn)}" missing in schema cache — retrying without it.`,
  );
  return insertFn(omitRecordKey(row, optionalColumn) as T);
}

export async function updateWithOptionalColumnFallback<T extends Record<string, unknown>, R>(
  updateFn: (row: T) => PromiseLike<{ data: R | null; error: PostgrestError | null }>,
  row: T,
  optionalColumn: keyof T,
): Promise<{ data: R | null; error: PostgrestError | null }> {
  return insertWithOptionalColumnFallback(updateFn, row, optionalColumn);
}

export async function queryWithOptionalSelectColumns<T>(
  queryFn: (select: string) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  select: string,
  optionalColumns: string[],
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  let currentSelect = select;
  let result = await queryFn(currentSelect);

  while (result.error) {
    const missingColumn = optionalColumns.find((column) =>
      isMissingSchemaColumnError(result.error, column),
    );
    if (!missingColumn) break;

    console.warn(
      `[schema-compat] Column "${missingColumn}" missing in schema cache — retrying select without it.`,
    );
    currentSelect = currentSelect
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== missingColumn)
      .join(", ");
    result = await queryFn(currentSelect);
  }

  return result;
}
