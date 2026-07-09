const CYCLE_2_LEVELS = ["CP", "CE1", "CE2"];
const CYCLE_3_LEVELS = ["CM1", "CM2", "6e"];

export function inferCycleFromLevels(levels: string[]): string {
  const normalized = levels.map((level) => level.toUpperCase().trim());

  if (normalized.some((level) => CYCLE_2_LEVELS.includes(level))) {
    return "Cycle 2";
  }

  if (normalized.some((level) => CYCLE_3_LEVELS.includes(level))) {
    return "Cycle 3";
  }

  return "";
}

export function inferNiveauxFromCycle(cycle: string): string {
  if (cycle === "Cycle 2") return CYCLE_2_LEVELS.join(", ");
  if (cycle === "Cycle 3") return CYCLE_3_LEVELS.join(", ");
  if (cycle === "Cycle 1") return "PS, MS, GS";
  return "";
}

export function normalizeCycleLabel(cycle: string): string {
  const normalized = cycle.trim().toLowerCase();
  if (normalized.includes("cycle 2") || normalized === "2") return "Cycle 2";
  if (normalized.includes("cycle 3") || normalized === "3") return "Cycle 3";
  if (normalized.includes("cycle 1") || normalized === "1") return "Cycle 1";
  return cycle.trim();
}
