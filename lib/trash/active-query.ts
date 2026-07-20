/** Filtre standard : éléments actifs uniquement (hors Corbeille). */
export function onlyActive<T extends { is: (column: string, value: null) => T }>(query: T): T {
  return query.is("deleted_at", null);
}

/** Filtre Corbeille : éléments supprimés uniquement. */
export function onlyTrashed<T extends { not: (column: string, operator: string, value: null) => T }>(
  query: T,
): T {
  return query.not("deleted_at", "is", null);
}
