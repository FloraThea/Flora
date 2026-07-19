import type { TimetableInput } from "@/lib/programming/types";
import type { TimetablePayload } from "./types";
import { EMPTY_TIMETABLE, payloadToTimetableInput } from "./timetable-input-utils";
import { loadActiveScheduleForProfile } from "./timetable-service";

export { EMPTY_TIMETABLE, payloadToTimetableInput } from "./timetable-input-utils";

export type ActiveTimetableResolution = {
  userId: string | null;
  profileId: string;
  payload: TimetablePayload | null;
  slotCount: number;
};

/** Source unique : profil courant + schedule actif contenant des créneaux. */
export async function getActiveTimetableForCurrentUser(): Promise<ActiveTimetableResolution> {
  const { getOrCreateTeacherProfile } = await import("@/lib/profile/profile-service");
  const { getServerAuthUserId } = await import("@/lib/supabase/auth-server");

  const bundle = await getOrCreateTeacherProfile();
  const userId = await getServerAuthUserId();
  const payload = await loadActiveScheduleForProfile(bundle.profile.id);

  return {
    userId,
    profileId: bundle.profile.id,
    payload,
    slotCount: payload?.slots.length ?? 0,
  };
}

/** Source unique de l'emploi du temps : timetable_schedules + timetable_slots */
export async function loadActiveTimetableInput(profileId: string): Promise<TimetableInput> {
  const payload = await loadActiveScheduleForProfile(profileId);
  if (!payload || payload.slots.length === 0) {
    return EMPTY_TIMETABLE;
  }

  return payloadToTimetableInput(
    payload.slots.map((slot) => ({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject,
      hours: slot.hours,
      slotType: slot.slotType,
    })),
  );
}

export async function hasActiveTimetableWithSlots(profileId: string): Promise<boolean> {
  const payload = await loadActiveScheduleForProfile(profileId);
  return Boolean(payload && payload.slots.length > 0);
}
