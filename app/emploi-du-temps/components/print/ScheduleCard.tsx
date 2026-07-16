"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { ScheduleCardView } from "@/lib/timetable/schedule-card/ScheduleCardView";
import type { PrintThemeTokens } from "@/lib/timetable/export/print-theme";
import type { PrintCustomization } from "@/lib/timetable/export/types";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type ScheduleCardProps = {
  slot: SmartTimetableSlot;
  theme: PrintThemeTokens;
  customization: PrintCustomization;
  variant?: "lesson" | "break";
  cellWidth?: number;
  cellHeight?: number;
};

export function ScheduleCard({
  slot,
  customization,
  cellHeight,
}: ScheduleCardProps) {
  const { themeId } = useFloraTheme();

  return (
    <ScheduleCardView
      slot={slot}
      mode="export"
      themeId={themeId}
      showComplementaryText={customization.showComplementaryText}
      showIcons={customization.showIcons}
      showLevels
      fixedHeightPx={cellHeight}
    />
  );
}
