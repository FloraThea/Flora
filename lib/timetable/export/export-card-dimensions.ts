/** Hauteurs uniformes des cartes export — indépendantes de la durée réelle. */
export const EXPORT_LESSON_CARD_HEIGHT = 140;
export const EXPORT_BREAK_CARD_HEIGHT = 70;
export const EXPORT_ROW_GAP_PX = 4;

const BREAK_SLOT_TYPES = new Set([
  "recreation",
  "pause_meridienne",
  "accueil",
  "sortie",
  "rangement",
]);

export function isExportBreakSlotType(slotType: string): boolean {
  return BREAK_SLOT_TYPES.has(slotType);
}

export function resolveExportCardHeight(slotType: string): number {
  return isExportBreakSlotType(slotType) ? EXPORT_BREAK_CARD_HEIGHT : EXPORT_LESSON_CARD_HEIGHT;
}
