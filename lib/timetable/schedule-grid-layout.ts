import { minutesBetween } from "@/lib/journal/date-utils";
import type { SmartTimetableSlot, TimetableSettings } from "./types";

/** 1,25 px/min → créneaux proportionnels à la durée visuelle. */
export const PX_PER_MINUTE = 1.25;

/** Durée visuelle fixe pour récréations et pause méridienne. */
export const VISUAL_BREAK_DURATION_MINUTES = 30;

export const BREAK_SLOT_TYPES = new Set<string>(["recreation", "pause_meridienne"]);

/** Seuil en dessous duquel la carte masque les infos secondaires (pas le texte complémentaire). */
export const COMPACT_SLOT_HEIGHT_PX = 44;

/** Hauteur minimale quand un texte complémentaire est présent (évite le masquage). */
export const MIN_SLOT_HEIGHT_WITH_COMPLEMENTARY_PX = 56;

/** Marge interne entre cartes voisines dans une colonne. */
export const SLOT_GAP_PX = 3;

/** @deprecated Utiliser COMPACT_SLOT_HEIGHT_PX */
export const MIN_SLOT_HEIGHT_PX = COMPACT_SLOT_HEIGHT_PX;

export type ScheduleEventKind = "lesson" | "recess" | "lunch";

export type ScheduleTimeScale = {
  dayStartMinutes: number;
  dayEndMinutes: number;
  totalMinutes: number;
  totalHeightPx: number;
  pxPerMinute: number;
};

export type TimelineSegment = {
  startMinutes: number;
  endMinutes: number;
  realDurationMinutes: number;
  visualDurationMinutes: number;
  kind: ScheduleEventKind;
  topPx: number;
  heightPx: number;
  label: string;
};

export type PositionedSlot = {
  slot: SmartTimetableSlot;
  day: string;
  topPx: number;
  heightPx: number;
  durationMinutes: number;
  visualDurationMinutes: number;
  compact: boolean;
};

export type TimeAxisLabel = {
  minutes: number;
  topPx: number;
  label: string;
  kind: "major" | "minor";
};

export type TimeAxisSegment = TimelineSegment;

export function getSlotEventKind(slot: Pick<SmartTimetableSlot, "slotType">): ScheduleEventKind {
  if (slot.slotType === "recreation") return "recess";
  if (slot.slotType === "pause_meridienne") return "lunch";
  return "lesson";
}

export function getVisualDurationMinutes(
  event: Pick<SmartTimetableSlot, "start" | "end" | "slotType">,
): number {
  const kind = getSlotEventKind(event);
  if (kind === "recess" || kind === "lunch") {
    return VISUAL_BREAK_DURATION_MINUTES;
  }
  return Math.max(1, minutesBetween(event.start, event.end));
}

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

export function formatMinutesToFrenchTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
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

function segmentKindForInterval(
  slots: SmartTimetableSlot[],
  startMinutes: number,
  endMinutes: number,
): ScheduleEventKind {
  for (const slot of slots) {
    if (!slot.start || !slot.end) continue;
    const slotStart = parseTimeToMinutes(slot.start);
    const slotEnd = parseTimeToMinutes(slot.end);
    if (slotStart >= endMinutes || slotEnd <= startMinutes) continue;

    const kind = getSlotEventKind(slot);
    if (kind === "lunch") return "lunch";
    if (kind === "recess") return "recess";
  }
  return "lesson";
}

function visualDurationForKind(kind: ScheduleEventKind, realDurationMinutes: number): number {
  if (kind === "recess" || kind === "lunch") {
    return VISUAL_BREAK_DURATION_MINUTES;
  }
  return realDurationMinutes;
}

/**
 * Construit une échelle horaire commune (chronologie réelle pour les bornes).
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

  return {
    dayStartMinutes,
    dayEndMinutes,
    totalMinutes,
    totalHeightPx: Math.round(totalMinutes * pxPerMinute),
    pxPerMinute,
  };
}

export function minutesToTopPx(minutes: number, scale: ScheduleTimeScale): number {
  return Math.round((minutes - scale.dayStartMinutes) * scale.pxPerMinute);
}

export function durationToHeightPx(durationMinutes: number, scale: ScheduleTimeScale): number {
  const raw = Math.round(durationMinutes * scale.pxPerMinute);
  return Math.max(4, raw - SLOT_GAP_PX);
}

export function isCompactSlotHeight(heightPx: number): boolean {
  return heightPx < COMPACT_SLOT_HEIGHT_PX;
}

/**
 * Segments horaires partagés par toutes les journées (durée réelle + hauteur visuelle).
 */
export function buildTimelineSegments(
  slots: SmartTimetableSlot[],
  scale: ScheduleTimeScale,
): TimelineSegment[] {
  const boundaries = new Set<number>([scale.dayStartMinutes, scale.dayEndMinutes]);

  for (const slot of slots) {
    if (slot.start) boundaries.add(parseTimeToMinutes(slot.start));
    if (slot.end) boundaries.add(parseTimeToMinutes(slot.end));
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments: TimelineSegment[] = [];
  let cumulativeTopPx = 0;

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startMinutes = sorted[index];
    const endMinutes = sorted[index + 1];
    const realDurationMinutes = endMinutes - startMinutes;
    if (realDurationMinutes <= 0) continue;

    const kind = segmentKindForInterval(slots, startMinutes, endMinutes);
    const visualDurationMinutes = visualDurationForKind(kind, realDurationMinutes);
    const heightPx = durationToHeightPx(visualDurationMinutes, scale);
    const label =
      realDurationMinutes >= 45
        ? `${formatMinutesToFrenchTime(startMinutes)} – ${formatMinutesToFrenchTime(endMinutes)}`
        : formatMinutesToFrenchTime(startMinutes);

    segments.push({
      startMinutes,
      endMinutes,
      realDurationMinutes,
      visualDurationMinutes,
      kind,
      topPx: cumulativeTopPx,
      heightPx,
      label,
    });

    cumulativeTopPx += heightPx + SLOT_GAP_PX;
  }

  return segments;
}

export function getVisualTopPx(minutes: number, segments: TimelineSegment[]): number {
  for (const segment of segments) {
    if (minutes >= segment.startMinutes && minutes < segment.endMinutes) {
      return segment.topPx;
    }
    if (minutes === segment.endMinutes) {
      return segment.topPx + segment.heightPx + SLOT_GAP_PX;
    }
  }

  const last = segments[segments.length - 1];
  if (last && minutes >= last.endMinutes) {
    return last.topPx + last.heightPx + SLOT_GAP_PX;
  }

  return 0;
}

export function applyVisualTimelineToScale(
  scale: ScheduleTimeScale,
  segments: TimelineSegment[],
): ScheduleTimeScale {
  const totalVisualMinutes = segments.reduce(
    (sum, segment) => sum + segment.visualDurationMinutes,
    0,
  );
  const totalHeightPx =
    segments.reduce((sum, segment) => sum + segment.heightPx, 0) +
    Math.max(0, segments.length - 1) * SLOT_GAP_PX;

  return {
    ...scale,
    totalMinutes: totalVisualMinutes,
    totalHeightPx,
  };
}

/**
 * Positionne chaque plage sur la timeline visuelle partagée.
 */
export function layoutSlotsOnScale(
  slots: SmartTimetableSlot[],
  scale: ScheduleTimeScale,
  segments?: TimelineSegment[],
): PositionedSlot[] {
  const timeline = segments ?? buildTimelineSegments(slots, scale);
  const positioned: PositionedSlot[] = [];

  for (const slot of slots) {
    if (!slot.day || !slot.start || !slot.end) continue;

    const startMinutes = parseTimeToMinutes(slot.start);
    const realDuration = slotDurationMinutes(slot);
    const visualDuration = getVisualDurationMinutes(slot);
    const topPx = getVisualTopPx(startMinutes, timeline);
    let heightPx = durationToHeightPx(visualDuration, scale);
    if (slot.customText?.trim()) {
      heightPx = Math.max(heightPx, MIN_SLOT_HEIGHT_WITH_COMPLEMENTARY_PX);
    }

    positioned.push({
      slot,
      day: slot.day,
      topPx,
      heightPx,
      durationMinutes: realDuration,
      visualDurationMinutes: visualDuration,
      compact: isCompactSlotHeight(heightPx) && !slot.customText?.trim(),
    });
  }

  return positioned;
}

/** Alias — segments horaires pour la colonne de temps. */
export function buildTimeAxisSegments(
  slots: SmartTimetableSlot[],
  scale: ScheduleTimeScale,
): TimeAxisSegment[] {
  return buildTimelineSegments(slots, scale);
}

export function buildTimeAxisLabels(
  scale: ScheduleTimeScale,
  segments: TimelineSegment[],
): TimeAxisLabel[] {
  const labels: TimeAxisLabel[] = [];

  for (const segment of segments) {
    labels.push({
      minutes: segment.startMinutes,
      topPx: segment.topPx,
      label: formatMinutesToTime(segment.startMinutes),
      kind: segment.realDurationMinutes >= 45 ? "major" : "minor",
    });
  }

  const last = segments[segments.length - 1];
  if (last) {
    labels.push({
      minutes: last.endMinutes,
      topPx: last.topPx + last.heightPx,
      label: formatMinutesToTime(last.endMinutes),
      kind: "major",
    });
  }

  if (labels.length === 0) {
    return buildLegacyTimeAxisLabels(scale);
  }

  return labels;
}

function buildLegacyTimeAxisLabels(scale: ScheduleTimeScale): TimeAxisLabel[] {
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
  timeSegments: TimeAxisSegment[];
  timelineSegments: TimelineSegment[];
  days: string[];
};

export function buildScheduleGridModel(
  slots: SmartTimetableSlot[],
  days: string[],
  settings?: TimetableSettings,
  pxPerMinute?: number,
): ScheduleGridModel {
  const baseScale = buildScheduleTimeScale(slots, settings, pxPerMinute);
  const timelineSegments = buildTimelineSegments(slots, baseScale);
  const scale = applyVisualTimelineToScale(baseScale, timelineSegments);
  const positioned = layoutSlotsOnScale(slots, baseScale, timelineSegments);
  const timeLabels = buildTimeAxisLabels(baseScale, timelineSegments);
  const timeSegments = timelineSegments;

  return { scale, positioned, timeLabels, timeSegments, timelineSegments, days };
}

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

export function collectOverlappingSlotIds(slots: SmartTimetableSlot[]): Set<string> {
  const ids = new Set<string>();
  for (const [a, b] of findOverlappingSlots(slots)) {
    ids.add(a);
    ids.add(b);
  }
  return ids;
}
