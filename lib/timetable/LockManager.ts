import { isAfternoonSlot, isMorningSlot } from "./time-grid";
import type { LockLevel, SmartTimetableSlot, TimetableLockInput, TimetableSettings } from "./types";

export class LockManager {
  isLocked(slot: SmartTimetableSlot): boolean {
    return slot.lockLevel !== "none";
  }

  getLockedSlots(slots: SmartTimetableSlot[]): SmartTimetableSlot[] {
    return slots.filter((slot) => this.isLocked(slot));
  }

  canModifySlot(
    slot: SmartTimetableSlot,
    allSlots: SmartTimetableSlot[],
    settings: TimetableSettings,
  ): boolean {
    if (slot.lockLevel === "full_day") return false;

    if (slot.lockLevel === "half_day") {
      const period = isMorningSlot(slot.start, settings) ? "morning" : "afternoon";
      return false;
    }

    if (slot.lockLevel === "session") return false;

    const dayLocks = allSlots.filter(
      (item) => item.day === slot.day && item.lockLevel === "full_day",
    );
    if (dayLocks.length > 0) return false;

    const halfDayLocks = allSlots.filter((item) => {
      if (item.day !== slot.day || item.lockLevel !== "half_day") return false;
      const itemPeriod = isMorningSlot(item.start, settings) ? "morning" : "afternoon";
      const slotPeriod = isMorningSlot(slot.start, settings) ? "morning" : "afternoon";
      return itemPeriod === slotPeriod;
    });
    if (halfDayLocks.length > 0) return false;

    return true;
  }

  applyLock(input: TimetableLockInput, slots: SmartTimetableSlot[], settings: TimetableSettings): SmartTimetableSlot[] {
    const lockLevel: LockLevel = input.locked ? input.scope : "none";

    return slots.map((slot) => {
      if (input.scope === "session" && slot.id === input.slotId) {
        return { ...slot, lockLevel };
      }

      if (input.scope === "full_day" && slot.day === input.day) {
        return { ...slot, lockLevel };
      }

      if (input.scope === "half_day" && slot.day === input.day) {
        const period = input.period ?? "morning";
        const slotPeriod = isMorningSlot(slot.start, settings) ? "morning" : "afternoon";
        if (slotPeriod === period) {
          return { ...slot, lockLevel };
        }
      }

      return slot;
    });
  }

  filterForRegeneration(
    slots: SmartTimetableSlot[],
    preserveLocks: boolean,
  ): { locked: SmartTimetableSlot[]; unlocked: SmartTimetableSlot[] } {
    if (!preserveLocks) {
      return { locked: [], unlocked: slots.map((slot) => ({ ...slot, lockLevel: "none" as LockLevel })) };
    }

    return {
      locked: slots.filter((slot) => this.isLocked(slot)),
      unlocked: slots.filter((slot) => !this.isLocked(slot)),
    };
  }
}

export const lockManager = new LockManager();
