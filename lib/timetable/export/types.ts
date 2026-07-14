import type { SmartTimetableSlot } from "../types";

/** Formats de page — A4 et A3 à ~300 dpi pour export HD. */
export type PageFormat = "a4" | "a3";

export type PrintOrientation = "portrait" | "landscape";

export type PrintStyleTheme = "flora" | "classic" | "pastel" | "nature" | "monochrome";

export type CardScale = "compact" | "normal" | "comfortable";
export type FontScale = "small" | "normal" | "large";

export type PrintCustomization = {
  orientation: PrintOrientation;
  pageFormat: PageFormat;
  styleTheme: PrintStyleTheme;
  cardScale: CardScale;
  fontScale: FontScale;
  showIcons: boolean;
  showTimes: boolean;
  showCompetencies: boolean;
  showObjectives: boolean;
  showComplementaryText: boolean;
};

export const DEFAULT_PRINT_CUSTOMIZATION: PrintCustomization = {
  orientation: "landscape",
  pageFormat: "a4",
  styleTheme: "flora",
  cardScale: "compact",
  fontScale: "large",
  showIcons: true,
  showTimes: true,
  showCompetencies: false,
  showObjectives: false,
  showComplementaryText: true,
};

export type SchedulePrintMeta = {
  className: string;
  teacherName: string;
  schoolYear: string;
  zone?: string;
  schoolName?: string;
  period?: string;
  scheduleName: string;
  generatedAt: string;
};

export type ExportFormat = "pdf" | "png" | "jpeg" | "print";

export const A4_PORTRAIT_PX = { width: 2480, height: 3508 } as const;
export const A4_LANDSCAPE_PX = { width: 3508, height: 2480 } as const;
export const A3_PORTRAIT_PX = { width: 3508, height: 4961 } as const;
export const A3_LANDSCAPE_PX = { width: 4961, height: 3508 } as const;

export function resolvePageDimensions(input: {
  pageFormat: PageFormat;
  orientation: PrintOrientation;
}): PageDimensions {
  if (input.pageFormat === "a3") {
    return input.orientation === "portrait" ? A3_PORTRAIT_PX : A3_LANDSCAPE_PX;
  }
  return input.orientation === "portrait" ? A4_PORTRAIT_PX : A4_LANDSCAPE_PX;
}

/** Standard 4-day week for premium print layout */
export const PREMIUM_PRINT_DAYS = ["Lundi", "Mardi", "Jeudi", "Vendredi"] as const;

export type PrintSlotCell = SmartTimetableSlot | null;

export type PrintScheduleRow =
  | {
      kind: "slots";
      start: string;
      end: string;
      cells: PrintSlotCell[];
    }
  | {
      kind: "break";
      start: string;
      end: string;
      slot: SmartTimetableSlot;
    };

export type PageDimensions = { width: number; height: number };
