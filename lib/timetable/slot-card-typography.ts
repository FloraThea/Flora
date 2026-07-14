/** Tailles de police fixes pour toutes les cartes EDT (écran + export). */
export const SCHEDULE_SUBJECT_FONT_SIZE_PX = 16;
export const SCHEDULE_TIME_FONT_SIZE_PX = 13;
export const SCHEDULE_SECONDARY_FONT_SIZE_PX = 13;

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

export function computeUniformPrintTypography(isCompact: boolean): {
  subjectPx: number;
  timePx: number;
  secondaryPx: number;
  showSecondary: boolean;
  showTertiary: boolean;
} {
  return {
    subjectPx: SCHEDULE_SUBJECT_FONT_SIZE_PX,
    timePx: SCHEDULE_TIME_FONT_SIZE_PX,
    secondaryPx: SCHEDULE_SECONDARY_FONT_SIZE_PX,
    showSecondary: !isCompact,
    showTertiary: !isCompact,
  };
}
