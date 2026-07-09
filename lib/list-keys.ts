/**
 * Builds a stable React list key from an id or composite fields.
 */
export function getListKey(
  id: string | number | null | undefined,
  fields: Array<string | number | null | undefined>,
  index: number,
  prefix = "item",
): string {
  if (id !== null && id !== undefined && String(id).length > 0) {
    return String(id);
  }

  const composite = fields
    .filter((value) => value !== null && value !== undefined && String(value).length > 0)
    .join("-");

  return composite ? `${composite}-${index}` : `${prefix}-${index}`;
}
