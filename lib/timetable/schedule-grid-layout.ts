import { minutesBetween } from "@/lib/journal/date-utils";
import type { SmartTimetableSlot, TimetableSettings } from "./types";

/** 1,2 px/min → créneaux proportionnels à la durée réelle. */
export const PX_PER_MINUTE = 1.25;

/** Hauteur minimale pour garder matière + horaires lisibles (≈ 15 min visuelles). */
export const MIN_SLOT_HEIGHT_PX = 52;

/** Marge interne entre cartes voisines dans une colonne. */
export const SLOT_GAP_PX = 3;

export type ScheduleTimeScale = {
  dayStartMinutes: number;
  dayEndMinutes: number;
  totalMinutes: number;
  totalHeightPx: number;
  pxPerMinute: number;
};

export type PositionedSlot = {
  slot: SmartTimetableSlot;
  day: string;
  topPx: number;
  heightPx: number;
  durationMinutes: number;
};

export type TimeAxisLabel = {
  minutes: number;
  topPx: number;
  label: string;
  kind: "major" | "minor";
};

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (m || 0);
}

export function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundDownToStep(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step;
}

function roundUpToStep(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

function slotDurationMinutes(slot: Pick<SmartTimetableSlot, "start" | "end">): number {
  return Math.max(1, minutesBetween(slot.start, slot.end));
}

/**
 * Construit une échelle horaire commune à partir des plages réelles + paramètres EDT.
 */
export function buildScheduleTimeScale(
  slots: SmartTimetableSlot[],
  settings?: TimetableSettings,
  pxPerMinute: number = PX_PER_MINUTE,
): ScheduleTimeScale {
  const relevant = slots.filter((slot) => slot.start && slot.end);
  const fallbackStart = settings?.morningStart ?? "08:30";
  const fallbackEnd = settings?.afternoonEnd ?? "16:30";

  let dayStartMinutes = parseTimeToMinutes(fallbackStart);
  let dayEndMinutes = parseTimeToMinutes(fallbackEnd);

  if (relevant.length > 0) {
    const starts = relevant.map((slot) => parseTimeToMinutes(slot.start));
    const ends = relevant.map((slot) => parseTimeToMinutes(slot.end));
    dayStartMinutes = Math.min(dayStartMinutes, ...starts);
    dayEndMinutes = Math.max(dayEndMinutes, ...ends);
  }

  dayStartMinutes = roundDownToStep(dayStartMinutes, 15);
  dayEndMinutes = roundUpToStep(dayEndMinutes, 15);

  const totalMinutes = Math.max(60, dayEndMinutes - dayStartMinutes);
  const totalHeightPx = Math.round(totalMinutes * pxPerMinute);

  return {
    dayStartMinutes,
    dayEndMinutes,
    totalMinutes,
    totalHeightPx,
    pxPerMinute,
  };
}

export function minutesToTopPx(minutes: number, scale: ScheduleTimeScale): number {
  return Math.round((minutes - scale.dayStartMinutes) * scale.pxPerMinute);
}

export function durationToHeightPx(durationMinutes: number, scale: ScheduleTimeScale): number {
  return Math.max(MIN_SLOT_HEIGHT_PX, Math.round(durationMinutes * scale.pxPerMinute) - SLOT_GAP_PX);
}

/**
 * Positionne chaque plage sur l'échelle commune (sans chevauchement intra-jour).
 */
export function layoutSlotsOnScale(
  slots: SmartTimetableSlot[],
  scale: ScheduleTimeScale,
): PositionedSlot[] {
  const positioned: PositionedSlot[] = [];

  for (const slot of slots) {
    if (!slot.day || !slot.start || !slot.end) continue;

    const startMinutes = parseTimeToMinutes(slot.start);
    const duration = slotDurationMinutes(slot);
    const topPx = minutesToTopPx(startMinutes, scale);
    const heightPx = durationToHeightPx(duration, scale);

    positioned.push({
      slot,
      day: slot.day,
      topPx,
      heightPx,
      durationMinutes: duration,
    });
  }

  return positioned;
}

/**
 * Étiquettes horaires alignées sur la grille (principales + intermédiaires si espace suffisant).
 */
export function buildTimeAxisLabels(scale: ScheduleTimeScale): TimeAxisLabel[] {
  const labels: TimeAxisLabel[] = [];
  const majorStep = scale.totalMinutes > 360 ? 60 : scale.totalMinutes > 240 ? 45 : 30;
  const minorStep = majorStep >= 60 ? 30 : 15;

  for (
    let minutes = scale.dayStartMinutes;
    minutes <= scale.dayEndMinutes;
    minutes += minorStep
  ) {
    const isMajor = (minutes - scale.dayStartMinutes) % majorStep === 0;
    labels.push({
      minutes,
      topPx: minutesToTopPx(minutes, scale),
      label: formatMinutesToTime(minutes),
      kind: isMajor ? "major" : "minor",
    });
  }

  return labels;
}

export type ScheduleGridModel = {
  scale: ScheduleTimeScale;
  positioned: PositionedSlot[];
  timeLabels: TimeAxisLabel[];
  days: string[];
};

export function buildScheduleGridModel(
  slots: SmartTimetableSlot[],
  days: string[],
  settings?: TimetableSettings,
  pxPerMinute?: number,
): ScheduleGridModel {
  const scale = buildScheduleTimeScale(slots, settings, pxPerMinute);
  const positioned = layoutSlotsOnScale(slots, scale);
  const timeLabels = buildTimeAxisLabels(scale);

  return { scale, positioned, timeLabels, days };
}

/** Détecte les chevauchements sur une même journée (hors récréations). */
export function findOverlappingSlots(slots: SmartTimetableSlot[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const skipTypes = new Set(["recreation", "pause_meridienne"]);

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.day !== b.day) continue;
      if (skipTypes.has(a.slotType) || skipTypes.has(b.slotType)) continue;

      const aStart = parseTimeToMinutes(a.start);
      const aEnd = parseTimeToMinutes(a.end);
      const bStart = parseTimeToMinutes(b.start);
      const bEnd = parseTimeToMinutes(b.end);

      if (aStart < bEnd && bStart < aEnd) {
        pairs.push([a.id, b.id]);
      }
    }
  }

  return pairs;
}
