export type SlotCardTypography = {
  timePx: number;
  titlePx: number;
  secondaryPx: number;
  compact: boolean;
  showSecondary: boolean;
  showTertiary: boolean;
  lineClamp: number;
};

export function computeSlotCardTypography(heightPx: number): SlotCardTypography {
  const compact = heightPx < 44;

  if (compact) {
    return {
      timePx: 10,
      titlePx: 12,
      secondaryPx: 0,
      compact: true,
      showSecondary: false,
      showTertiary: false,
      lineClamp: 1,
    };
  }

  if (heightPx < 64) {
    return {
      timePx: 11,
      titlePx: 14,
      secondaryPx: 11,
      compact: false,
      showSecondary: true,
      showTertiary: false,
      lineClamp: 1,
    };
  }

  if (heightPx < 96) {
    return {
      timePx: 12,
      titlePx: 15,
      secondaryPx: 12,
      compact: false,
      showSecondary: true,
      showTertiary: true,
      lineClamp: 2,
    };
  }

  return {
    timePx: 13,
    titlePx: 17,
    secondaryPx: 13,
    compact: false,
    showSecondary: true,
    showTertiary: true,
    lineClamp: 3,
  };
}
