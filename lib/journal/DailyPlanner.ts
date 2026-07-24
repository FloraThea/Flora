import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { StoredSeance } from "@/lib/seances/types";
import { lessonAssembler } from "./LessonAssembler";
import type { JournalScheduleSlot } from "./journal-timetable";
import { isNonPedagogicalSlot } from "./journal-slot-utils";
import { ritualAssembler } from "./RitualAssembler";
import type { ResolvedSchoolDay } from "./ScheduleEngine";
import type { JournalEntry, JournalResources, RitualDefinition } from "./types";

function buildBreakEntry(input: {
  journalId: string;
  sortOrder: number;
  slot: JournalScheduleSlot;
}): Omit<JournalEntry, "id" | "observation"> {
  return {
    journalId: input.journalId,
    sortOrder: input.sortOrder,
    entryType: "break",
    startTime: input.slot.start,
    endTime: input.slot.end,
    matiere: input.slot.subject,
    seanceId: null,
    ritualId: null,
    ritualLabel: "",
    competence: "",
    objectif: "",
    dureeMinutes: lessonAssembler.estimateMinutes(input.slot),
    organisation: "",
    materiel: { items: [], guides: [], albums: [], fiches: [], jeux: [], autres: [] },
    documents: [],
    resources: {
      guides: [],
      albums: [],
      fiches: [],
      documents: [],
      jeux: [],
      videos: [],
      numeriques: [],
      liens: [],
    },
    observations: "",
    slotData: {
      slotType: input.slot.slotType,
      subSubject: input.slot.subSubject ?? "",
      sourceScheduleSlotId: input.slot.sourceScheduleSlotId ?? null,
    },
    metadata: {
      source: "timetable",
      fillState: "break",
      isPersisted: false,
    },
  };
}

function findProfileRitualForSlot(
  profile: TeacherProfileBundle,
  slot: JournalScheduleSlot,
): RitualDefinition | null {
  return ritualAssembler.findRitualForJournalSlot({ profile, slot });
}

export class DailyPlanner {
  planDay(input: {
    journalId: string;
    resolvedDay: ResolvedSchoolDay;
    profile: TeacherProfileBundle;
    seances: StoredSeance[];
    resourcesByMatiere: Record<string, JournalResources>;
    linkSeances?: boolean;
    restitutionMode?: boolean;
  }): Omit<JournalEntry, "id" | "observation">[] {
    const entries: Omit<JournalEntry, "id" | "observation">[] = [];
    let sortOrder = 1;
    const shouldLink = input.linkSeances ?? input.restitutionMode ?? false;

    for (const slot of input.resolvedDay.slots as JournalScheduleSlot[]) {
      if (isNonPedagogicalSlot(slot.slotType)) {
        entries.push(
          buildBreakEntry({
            journalId: input.journalId,
            sortOrder,
            slot,
          }),
        );
        sortOrder += 1;
        continue;
      }

      if (input.restitutionMode && slot.slotType === "rituel") {
        const ritual = findProfileRitualForSlot(input.profile, slot);
        if (ritual) {
          entries.push(
            lessonAssembler.buildRitualEntryFromProfile({
              journalId: input.journalId,
              sortOrder,
              slot,
              ritual,
            }),
          );
        } else {
          entries.push(
            lessonAssembler.buildEmptySlotEntry({
              journalId: input.journalId,
              sortOrder,
              slot: { ...slot, slotType: "rituel" },
            }),
          );
        }
        sortOrder += 1;
        continue;
      }

      const seance =
        shouldLink
          ? lessonAssembler.findSeanceForSlot(input.seances, slot, input.resolvedDay.date)
          : null;

      if (seance) {
        entries.push(
          lessonAssembler.buildEntryFromSeance({
            journalId: input.journalId,
            sortOrder,
            slot,
            seance,
            libraryResources: input.resourcesByMatiere[seance.matiere.toLowerCase()],
          }),
        );
      } else if (input.restitutionMode) {
        entries.push(
          lessonAssembler.buildMissingSeanceEntry({
            journalId: input.journalId,
            sortOrder,
            slot,
          }),
        );
      } else {
        entries.push(
          lessonAssembler.buildEmptySlotEntry({
            journalId: input.journalId,
            sortOrder,
            slot,
          }),
        );
      }

      sortOrder += 1;
    }

    return entries;
  }
}

export const dailyPlanner = new DailyPlanner();
