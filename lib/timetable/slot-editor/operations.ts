import { minutesBetween } from "@/lib/journal/date-utils";
import { addMinutes, hoursFromSlot, slotsOverlap, sortSlots } from "../time-grid";
import type { SmartTimetableSlot, TimetableConflict } from "../types";

export type SlotLevel = "CP" | "CE1" | "CE2" | "Multi-niveaux";

export type SlotEditorMetadata = {
  icon?: string;
  levels?: SlotLevel[];
  displayText?: string;
  notes?: string;
  useCustomColor?: boolean;
  teacherName?: string;
};

export function readSlotMeta(slot: SmartTimetableSlot): SlotEditorMetadata {
  const m = slot.metadata ?? {};
  return {
    icon: typeof m.icon === "string" ? m.icon : undefined,
    levels: Array.isArray(m.levels) ? (m.levels as SlotLevel[]) : undefined,
    displayText: typeof m.displayText === "string" ? m.displayText : undefined,
    notes: typeof m.notes === "string" ? m.notes : undefined,
    useCustomColor: Boolean(m.useCustomColor),
    teacherName: typeof m.teacherName === "string" ? m.teacherName : undefined,
  };
}

export function mergeSlotMeta(
  slot: SmartTimetableSlot,
  patch: SlotEditorMetadata,
): Record<string, unknown> {
  return {
    ...slot.metadata,
    ...patch,
  };
}

export function durationMinutes(start: string, end: string): number {
  return Math.max(0, minutesBetween(start, end));
}

export function endFromDuration(start: string, minutes: number): string {
  return addMinutes(start, minutes);
}

export function detectSlotConflicts(slots: SmartTimetableSlot[]): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.day !== b.day) continue;
      if (["recreation", "pause_meridienne"].includes(a.slotType)) continue;
      if (["recreation", "pause_meridienne"].includes(b.slotType)) continue;
      if (slotsOverlap(a, b)) {
        conflicts.push({
          code: "overlap",
          severity: "error",
          message: `Conflit horaire : ${a.subject} (${a.start}–${a.end}) et ${b.subject} (${b.start}–${b.end}) le ${a.day}.`,
          slotIds: [a.id, b.id],
          day: a.day,
        });
      }
    }
  }

  return conflicts;
}

export function shiftFollowingSlotsOnDay(
  slots: SmartTimetableSlot[],
  day: string,
  fromStart: string,
  deltaMinutes: number,
): SmartTimetableSlot[] {
  if (deltaMinutes === 0) return slots;

  return slots.map((slot) => {
    if (slot.day !== day || slot.start < fromStart) return slot;
    return {
      ...slot,
      start: addMinutes(slot.start, deltaMinutes),
      end: addMinutes(slot.end, deltaMinutes),
      hours: hoursFromSlot({
        start: addMinutes(slot.start, deltaMinutes),
        end: addMinutes(slot.end, deltaMinutes),
        hours: slot.hours,
      }),
    };
  });
}

export function newSlotId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function duplicateSlot(slot: SmartTimetableSlot, scheduleId: string): SmartTimetableSlot {
  return {
    ...slot,
    id: newSlotId(),
    scheduleId,
    lockLevel: "none",
    metadata: { ...slot.metadata },
  };
}

export function mergeTwoSlots(a: SmartTimetableSlot, b: SmartTimetableSlot): SmartTimetableSlot {
  const subject = a.subject === b.subject ? a.subject : `${a.subject} / ${b.subject}`;
  const subSubject = [a.subSubject, b.subSubject].filter(Boolean).join(" · ");
  const customText = [a.customText, b.customText].filter(Boolean).join("\n");

  return {
    ...a,
    subject,
    subSubject,
    customText,
    start: a.start < b.start ? a.start : b.start,
    end: a.end > b.end ? a.end : b.end,
    hours: hoursFromSlot({
      start: a.start < b.start ? a.start : b.start,
      end: a.end > b.end ? a.end : b.end,
      hours: a.hours + b.hours,
    }),
    metadata: {
      ...a.metadata,
      mergedFrom: [a.id, b.id],
    },
  };
}

export function splitSlotAt(
  slot: SmartTimetableSlot,
  splitTime: string,
  secondSubject: string,
  secondSubSubject: string,
): [SmartTimetableSlot, SmartTimetableSlot] {
  const first: SmartTimetableSlot = {
    ...slot,
    end: splitTime,
    hours: hoursFromSlot({ start: slot.start, end: splitTime, hours: slot.hours }),
  };

  const second: SmartTimetableSlot = {
    ...duplicateSlot(slot, slot.scheduleId),
    subject: secondSubject || slot.subject,
    subSubject: secondSubSubject,
    start: splitTime,
    end: slot.end,
    hours: hoursFromSlot({ start: splitTime, end: slot.end, hours: slot.hours }),
  };

  return [first, second];
}

export function createBlankSlot(input: {
  scheduleId: string;
  day: string;
  start: string;
  end: string;
}): SmartTimetableSlot {
  return {
    id: newSlotId(),
    scheduleId: input.scheduleId,
    day: input.day,
    start: input.start,
    end: input.end,
    subject: "Français",
    subSubject: "",
    customText: "",
    color: "",
    gradient: "",
    slotType: "seance",
    lockLevel: "none",
    hours: hoursFromSlot({ start: input.start, end: input.end, hours: 1 }),
    room: "",
    intervenant: "",
    label: "Français",
    sortOrder: 0,
    metadata: {},
  };
}

export function moveSlotWithinDay(
  slots: SmartTimetableSlot[],
  slotId: string,
  direction: "up" | "down",
): SmartTimetableSlot[] {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return slots;

  const daySlots = sortSlots(slots.filter((s) => s.day === slot.day));
  const index = daySlots.findIndex((s) => s.id === slotId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= daySlots.length) return slots;

  const other = daySlots[swapIndex];
  const swapped = slots.map((s) => {
    if (s.id === slot.id) {
      return { ...s, start: other.start, end: other.end, hours: other.hours };
    }
    if (s.id === other.id) {
      return { ...s, start: slot.start, end: slot.end, hours: slot.hours };
    }
    return s;
  });

  return sortSlots(swapped);
}

export function insertSlotAfter(
  slots: SmartTimetableSlot[],
  afterSlotId: string | null,
  day: string,
  newSlot: SmartTimetableSlot,
  options?: { preserveTimes?: boolean },
): SmartTimetableSlot[] {
  if (options?.preserveTimes) {
    return sortSlots([...slots, { ...newSlot, day }]);
  }

  const daySlots = sortSlots(slots.filter((s) => s.day === day));
  let start = "08:30";
  let end = "09:30";

  if (afterSlotId) {
    const after = daySlots.find((s) => s.id === afterSlotId);
    if (after) {
      start = after.end;
      end = addMinutes(start, durationMinutes(after.start, after.end) || 60);
    }
  } else if (daySlots.length > 0) {
    const last = daySlots[daySlots.length - 1];
    start = last.end;
    end = addMinutes(start, 60);
  }

  const placed = {
    ...newSlot,
    day,
    start,
    end,
    hours: hoursFromSlot({ start, end, hours: 1 }),
  };

  return sortSlots([...slots, placed]);
}

export function isDraftSlotId(id: string): boolean {
  return id.startsWith("draft-");
}

export function buildDraftSlot(input: {
  scheduleId: string;
  day: string;
  existingSlots: SmartTimetableSlot[];
  afterSlotId?: string | null;
  morningStart?: string;
}): SmartTimetableSlot {
  const daySlots = sortSlots(input.existingSlots.filter((slot) => slot.day === input.day));
  let start = input.morningStart ?? "08:30";
  let end = addMinutes(start, 60);

  if (input.afterSlotId) {
    const after = daySlots.find((slot) => slot.id === input.afterSlotId);
    if (after) {
      start = after.end;
      end = addMinutes(start, durationMinutes(after.start, after.end) || 60);
    }
  } else if (daySlots.length > 0) {
    const last = daySlots[daySlots.length - 1];
    start = last.end;
    end = addMinutes(start, 60);
  }

  return {
    ...createBlankSlot({
      scheduleId: input.scheduleId,
      day: input.day,
      start,
      end,
    }),
    id: `draft-${newSlotId()}`,
    metadata: { isDraft: true },
  };
}

export function rowsToSlots(
  rows: Array<{
    day: string;
    start: string;
    end: string;
    subject: string;
    subSubject?: string;
    displayText?: string;
    customText?: string;
    room?: string;
  }>,
  scheduleId: string,
): SmartTimetableSlot[] {
  return rows
    .filter((row) => row.day && row.start && row.end && row.subject)
    .map((row) => ({
      ...createBlankSlot({
        scheduleId,
        day: row.day,
        start: row.start,
        end: row.end,
      }),
      subject: row.subject,
      subSubject: row.subSubject ?? "",
      customText: row.customText ?? "",
      label: row.subject,
      room: row.room ?? "",
      metadata: {
        displayText: row.displayText ?? "",
      },
    }));
}

export function removeSlot(
  slots: SmartTimetableSlot[],
  slotId: string,
  reorganize: boolean,
): SmartTimetableSlot[] {
  const removed = slots.find((s) => s.id === slotId);
  if (!removed) return slots;

  const remaining = slots.filter((s) => s.id !== slotId);
  if (!reorganize) return remaining;

  const gap = durationMinutes(removed.start, removed.end);
  return shiftFollowingSlotsOnDay(remaining, removed.day, removed.end, -gap);
}
