/** Tailles de police fixes pour toutes les cartes EDT (écran). */
export const SCHEDULE_SUBJECT_FONT_SIZE_PX = 16;
export const SCHEDULE_TIME_FONT_SIZE_PX = 13;
export const SCHEDULE_SECONDARY_FONT_SIZE_PX = 13;

/** Police principale export PDF / PNG / JPG — ne jamais réduire par hauteur. */
export const EXPORT_SCHEDULE_FONT_SIZE_PX = 30;
export const EXPORT_SCHEDULE_TIME_FONT_SIZE_PX = 26;

export type SlotCardTypography = {
  timePx: number;
  titlePx: number;
  secondaryPx: number;
  compact: boolean;
  showSecondary: boolean;
  showTertiary: boolean;
  lineClamp: number;
};

/**
 * Typographie uniforme : la hauteur de carte ne modifie jamais la taille de police.
 * Le mode compact masque uniquement les informations secondaires.
 */
export function computeSlotCardTypography(heightPx: number): SlotCardTypography {
  const compact = heightPx < 44;

  return {
    timePx: SCHEDULE_TIME_FONT_SIZE_PX,
    titlePx: SCHEDULE_SUBJECT_FONT_SIZE_PX,
    secondaryPx: SCHEDULE_SECONDARY_FONT_SIZE_PX,
    compact,
    showSecondary: !compact,
    showTertiary: !compact,
    lineClamp: compact ? 1 : 2,
  };
}

export function computeUniformPrintTypography(_isCompact = false): {
  subjectPx: number;
  timePx: number;
  secondaryPx: number;
  showSecondary: boolean;
  showTertiary: boolean;
} {
  return {
    subjectPx: EXPORT_SCHEDULE_FONT_SIZE_PX,
    timePx: EXPORT_SCHEDULE_TIME_FONT_SIZE_PX,
    secondaryPx: EXPORT_SCHEDULE_FONT_SIZE_PX,
    showSecondary: true,
    showTertiary: true,
  };
}
