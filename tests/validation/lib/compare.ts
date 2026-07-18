export type ValidationDiff = {
  path: string;
  expected: unknown;
  actual: unknown;
};

export type CompareResult = {
  ok: boolean;
  diffs: ValidationDiff[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function compareValues(path: string, expected: unknown, actual: unknown, diffs: ValidationDiff[]) {
  if (Object.is(expected, actual)) return;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      diffs.push({ path: `${path}.length`, expected: expected.length, actual: actual.length });
    }
    const max = Math.max(expected.length, actual.length);
    for (let index = 0; index < max; index += 1) {
      compareValues(`${path}[${index}]`, expected[index], actual[index], diffs);
    }
    return;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      compareValues(path ? `${path}.${key}` : key, expected[key], actual[key], diffs);
    }
    return;
  }
  diffs.push({ path, expected, actual });
}

export function compareSnapshots(expected: unknown, actual: unknown): CompareResult {
  const diffs: ValidationDiff[] = [];
  compareValues("", expected, actual, diffs);
  return { ok: diffs.length === 0, diffs };
}

export function verifySourceCellsPreserved(
  sourceCells: Array<{ row: number; col: number; value: string }>,
  rows: Array<{ sourceRowIndex: number | null; rawCells: string[] }>,
): ValidationDiff[] {
  const diffs: ValidationDiff[] = [];
  const rowsByIndex = new Map<number, string[]>();
  for (const row of rows) {
    if (row.sourceRowIndex !== null) {
      rowsByIndex.set(row.sourceRowIndex, row.rawCells);
    }
  }

  for (const [rowIndex, parsedCells] of rowsByIndex.entries()) {
    const sourceRowCells = sourceCells.filter((cell) => cell.row === rowIndex);
    for (const cell of sourceRowCells) {
      const parsedValue = parsedCells[cell.col] ?? "";
      if (parsedValue.trim() !== cell.value.trim()) {
        diffs.push({
          path: `cell[${rowIndex},${cell.col}]`,
          expected: cell.value,
          actual: parsedValue,
        });
      }
    }
  }

  return diffs;
}
