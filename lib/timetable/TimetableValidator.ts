import { getOfficialWeeklyHours } from "./bo-hours";
import { hoursFromSlot, slotsOverlap, sortSlots } from "./time-grid";
import type {
  SchoolDay,
  SmartTimetableSlot,
  TimetableConflict,
  TimetableSettings,
  TimetableValidationResult,
} from "./types";
import type { SchoolLevel } from "@/lib/programming/types";

export class TimetableValidator {
  validate(
    slots: SmartTimetableSlot[],
    settings: TimetableSettings,
    levels: SchoolLevel[],
    weeklyHoursTarget: Record<string, number>,
  ): TimetableValidationResult {
    const conflicts: TimetableConflict[] = [];
    const weeklyHoursPlaced = this.computeWeeklyHours(slots);

    conflicts.push(...this.detectOverlaps(slots));
    conflicts.push(...this.detectRoomConflicts(slots));
    conflicts.push(...this.detectIntervenantConflicts(slots));
    conflicts.push(...this.detectConsecutiveViolations(slots, settings));
    conflicts.push(...this.detectBoHourGaps(weeklyHoursPlaced, weeklyHoursTarget));
    conflicts.push(...this.detectEpsPlacement(slots));

    const hasErrors = conflicts.some((conflict) => conflict.severity === "error");

    return {
      valid: !hasErrors,
      conflicts,
      weeklyHoursPlaced,
      weeklyHoursTarget: weeklyHoursTarget ?? getOfficialWeeklyHours(levels),
    };
  }

  computeWeeklyHours(slots: SmartTimetableSlot[]): Record<string, number> {
    const totals: Record<string, number> = {};

    for (const slot of slots) {
      if (["recreation", "pause_meridienne", "rituel"].includes(slot.slotType)) continue;
      const subject = slot.subject.trim();
      if (!subject) continue;
      totals[subject] = (totals[subject] ?? 0) + hoursFromSlot(slot);
    }

    return totals;
  }

  private detectOverlaps(slots: SmartTimetableSlot[]): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];
    const sorted = sortSlots(slots);

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[i].day !== sorted[j].day) continue;
        if (slotsOverlap(sorted[i], sorted[j])) {
          conflicts.push({
            code: "overlap",
            severity: "error",
            message: `Chevauchement le ${sorted[i].day} entre ${sorted[i].subject} et ${sorted[j].subject}.`,
            slotIds: [sorted[i].id, sorted[j].id],
            day: sorted[i].day,
          });
        }
      }
    }

    return conflicts;
  }

  private detectRoomConflicts(slots: SmartTimetableSlot[]): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];
    const withRoom = slots.filter((slot) => slot.room.trim());

    for (let i = 0; i < withRoom.length; i += 1) {
      for (let j = i + 1; j < withRoom.length; j += 1) {
        const a = withRoom[i];
        const b = withRoom[j];
        if (a.room !== b.room) continue;
        if (slotsOverlap(a, b)) {
          conflicts.push({
            code: "room_conflict",
            severity: "error",
            message: `Conflit de salle « ${a.room} » le ${a.day}.`,
            slotIds: [a.id, b.id],
            day: a.day,
          });
        }
      }
    }

    return conflicts;
  }

  private detectIntervenantConflicts(slots: SmartTimetableSlot[]): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];
    const withIntervenant = slots.filter((slot) => slot.intervenant.trim());

    for (let i = 0; i < withIntervenant.length; i += 1) {
      for (let j = i + 1; j < withIntervenant.length; j += 1) {
        const a = withIntervenant[i];
        const b = withIntervenant[j];
        if (a.intervenant !== b.intervenant) continue;
        if (slotsOverlap(a, b)) {
          conflicts.push({
            code: "intervenant_conflict",
            severity: "error",
            message: `Conflit intervenant « ${a.intervenant} » le ${a.day}.`,
            slotIds: [a.id, b.id],
            day: a.day,
          });
        }
      }
    }

    return conflicts;
  }

  private detectConsecutiveViolations(
    slots: SmartTimetableSlot[],
    settings: TimetableSettings,
  ): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];

    for (const constraint of settings.constraints.filter((item) => item.type === "avoid_consecutive")) {
      if (!constraint.subject) continue;

      const byDay = new Map<string, SmartTimetableSlot[]>();
      for (const slot of slots.filter((item) => item.subject === constraint.subject)) {
        const list = byDay.get(slot.day) ?? [];
        list.push(slot);
        byDay.set(slot.day, list);
      }

      for (const [day, daySlots] of byDay) {
        const ordered = sortSlots(daySlots);
        for (let i = 1; i < ordered.length; i += 1) {
          if (ordered[i - 1].end === ordered[i].start) {
            conflicts.push({
              code: "consecutive_subject",
              severity: "warning",
              message: constraint.message,
              slotIds: [ordered[i - 1].id, ordered[i].id],
              day,
            });
          }
        }
      }
    }

    return conflicts;
  }

  private detectBoHourGaps(
    placed: Record<string, number>,
    target: Record<string, number>,
  ): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];

    for (const [subject, expected] of Object.entries(target)) {
      const actual = placed[subject] ?? 0;
      const delta = Math.abs(actual - expected);
      if (delta > 0.5) {
        conflicts.push({
          code: actual < expected ? "bo_hours_missing" : "bo_hours_excess",
          severity: actual < expected ? "warning" : "error",
          message:
            actual < expected
              ? `${subject} : ${actual}h placées sur ${expected}h BO.`
              : `${subject} : ${actual}h placées, dépassement BO (${expected}h).`,
          slotIds: [],
        });
      }
    }

    return conflicts;
  }

  private detectEpsPlacement(slots: SmartTimetableSlot[]): TimetableConflict[] {
    const epsSlots = slots.filter((slot) => slot.subject === "EPS" || slot.slotType === "eps");
    const conflicts: TimetableConflict[] = [];

    for (const slot of epsSlots) {
      if (slot.start < "13:00") {
        conflicts.push({
          code: "eps_morning",
          severity: "warning",
          message: `EPS le ${slot.day} en matinée — préférer l'après-midi.`,
          slotIds: [slot.id],
          day: slot.day as SchoolDay,
        });
      }
    }

    return conflicts;
  }
}

export const timetableValidator = new TimetableValidator();
