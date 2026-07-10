import type { SmartTimetableSlot } from "../types";

/** Page formats — extensible for A3 / Letter US later */
export type PageFormat = "a4";

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
  cardScale: "comfortable",
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
