export const NON_PEDAGOGICAL_SLOT_TYPES = new Set(["recreation", "pause_meridienne"]);

export function isNonPedagogicalSlot(slotType: string): boolean {
  return NON_PEDAGOGICAL_SLOT_TYPES.has(slotType);
}
