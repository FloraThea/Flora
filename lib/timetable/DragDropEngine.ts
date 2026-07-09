import { lockManager } from "./LockManager";
import { hoursFromSlot, slotsOverlap, sortSlots } from "./time-grid";
import { timetableValidator } from "./TimetableValidator";
import type {
  SmartTimetableSlot,
  TimetableMoveInput,
  TimetableSettings,
  TimetableValidationResult,
} from "./types";
import type { SchoolLevel } from "@/lib/programming/types";

export type MoveSlotResult = {
  slots: SmartTimetableSlot[];
  validation: TimetableValidationResult;
  moved: boolean;
  message: string;
};

export class DragDropEngine {
  moveSlot(
    input: TimetableMoveInput,
    slots: SmartTimetableSlot[],
    settings: TimetableSettings,
    levels: SchoolLevel[],
    weeklyHoursTarget: Record<string, number>,
  ): MoveSlotResult {
    const slot = slots.find((item) => item.id === input.slotId);
    if (!slot) {
      return {
        slots,
        validation: timetableValidator.validate(slots, settings, levels, weeklyHoursTarget),
        moved: false,
        message: "Créneau introuvable.",
      };
    }

    if (!lockManager.canModifySlot(slot, slots, settings)) {
      return {
        slots,
        validation: timetableValidator.validate(slots, settings, levels, weeklyHoursTarget),
        moved: false,
        message: "Ce créneau est verrouillé.",
      };
    }

    const movedSlot: SmartTimetableSlot = {
      ...slot,
      day: input.targetDay,
      start: input.targetStart,
      end: input.targetEnd,
      hours: hoursFromSlot({
        start: input.targetStart,
        end: input.targetEnd,
        hours: slot.hours,
      }),
    };

    const others = slots.filter((item) => item.id !== slot.id);
    const overlap = others.find(
      (item) =>
        item.day === movedSlot.day &&
        slotsOverlap(item, movedSlot) &&
        !["recreation", "pause_meridienne"].includes(item.slotType),
    );

    if (overlap) {
      return {
        slots,
        validation: timetableValidator.validate(slots, settings, levels, weeklyHoursTarget),
        moved: false,
        message: `Conflit avec ${overlap.subject} (${overlap.start}-${overlap.end}).`,
      };
    }

    const nextSlots = sortSlots(
      others
        .concat(movedSlot)
        .map((item, index) => ({ ...item, sortOrder: index })),
    );

    return {
      slots: nextSlots,
      validation: timetableValidator.validate(nextSlots, settings, levels, weeklyHoursTarget),
      moved: true,
      message: "Créneau déplacé.",
    };
  }
}

export const dragDropEngine = new DragDropEngine();
