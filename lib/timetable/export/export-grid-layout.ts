import type { SmartTimetableSlot } from "../types";
import { EXPORT_ROW_GAP_PX, resolveExportCardHeight } from "./export-card-dimensions";

export type ExportGridRow = {
  start: string;
  end: string;
  rowHeightPx: number;
  cells: Array<{ day: string; slot: SmartTimetableSlot | null }>;
};

export type ExportGridModel = {
  rows: ExportGridRow[];
  totalHeightPx: number;
  timeLabels: string[];
};

/**
 * Grille export à hauteurs uniformes — une ligne par horaire de début.
 */
export function buildUniformExportGrid(
  slots: SmartTimetableSlot[],
  days: string[],
): ExportGridModel {
  const relevant = slots.filter((slot) => days.includes(slot.day));
  const starts = [...new Set(relevant.map((slot) => slot.start))].sort((a, b) =>
    a.localeCompare(b),
  );

  const rows: ExportGridRow[] = starts.map((start) => {
    const cells = days.map((day) => {
      const slot = relevant.find((item) => item.day === day && item.start === start) ?? null;
      return { day, slot };
    });

    const activeSlots = cells.map((cell) => cell.slot).filter(Boolean) as SmartTimetableSlot[];
    const end = activeSlots[0]?.end ?? "";
    const rowHeightPx =
      activeSlots.length === 0
        ? resolveExportCardHeight("seance")
        : activeSlots.reduce(
            (max, slot) => Math.max(max, resolveExportCardHeight(slot.slotType)),
            0,
          );

    return { start, end, rowHeightPx, cells };
  });

  const totalHeightPx = rows.reduce(
    (sum, row) => sum + row.rowHeightPx + EXPORT_ROW_GAP_PX,
    0,
  );

  return {
    rows,
    totalHeightPx,
    timeLabels: starts,
  };
}

export function estimateExportPageCount(input: {
  totalHeightPx: number;
  availableHeightPx: number;
}): number {
  if (input.availableHeightPx <= 0) return 1;
  return Math.max(1, Math.ceil(input.totalHeightPx / input.availableHeightPx));
}
