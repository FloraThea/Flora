import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { StoredSeance } from "@/lib/seances/types";
import { lessonAssembler } from "./LessonAssembler";
import type { JournalScheduleSlot } from "./journal-timetable";
import { isNonPedagogicalSlot } from "./journal-slot-utils";
import type { ResolvedSchoolDay } from "./ScheduleEngine";
import type { JournalEntry, JournalResources } from "./types";

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

export class DailyPlanner {
  planDay(input: {
    journalId: string;
    resolvedDay: ResolvedSchoolDay;
    profile: TeacherProfileBundle;
    seances: StoredSeance[];
    resourcesByMatiere: Record<string, JournalResources>;
    linkSeances?: boolean;
  }): Omit<JournalEntry, "id" | "observation">[] {
    const entries: Omit<JournalEntry, "id" | "observation">[] = [];
    let sortOrder = 1;

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

      const seance =
        input.linkSeances === true
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
