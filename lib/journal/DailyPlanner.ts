import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { StoredSeance } from "@/lib/seances/types";
import { lessonAssembler } from "./LessonAssembler";
import { ritualAssembler } from "./RitualAssembler";
import { scheduleEngine, type ResolvedSchoolDay } from "./ScheduleEngine";
import type { JournalEntry, JournalResources, RitualDefinition } from "./types";

function buildRitualEntry(input: {
  journalId: string;
  sortOrder: number;
  ritual: RitualDefinition;
}): Omit<JournalEntry, "id" | "observation"> {
  return {
    journalId: input.journalId,
    sortOrder: input.sortOrder,
    entryType: "ritual",
    startTime: input.ritual.startTime ?? "",
    endTime: input.ritual.endTime ?? "",
    matiere: input.ritual.matiere ?? "Rituel",
    seanceId: null,
    ritualId: input.ritual.id,
    ritualLabel: input.ritual.label,
    competence: "",
    objectif: input.ritual.objectif,
    dureeMinutes: input.ritual.dureeMinutes,
    organisation: input.ritual.organisation,
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
    slotData: {},
    metadata: { source: "rituals", movable: true },
  };
}

export class DailyPlanner {
  planDay(input: {
    journalId: string;
    resolvedDay: ResolvedSchoolDay;
    profile: TeacherProfileBundle;
    seances: StoredSeance[];
    resourcesByMatiere: Record<string, JournalResources>;
  }): Omit<JournalEntry, "id" | "observation">[] {
    const rituals = ritualAssembler.buildRituals({
      profile: input.profile,
      slots: input.resolvedDay.slots,
      dayName: input.resolvedDay.dayName,
    });

    const entries: Omit<JournalEntry, "id" | "observation">[] = [];
    let sortOrder = 1;

    for (const ritual of rituals.filter((item) => item.startTime)) {
      entries.push(
        buildRitualEntry({
          journalId: input.journalId,
          sortOrder,
          ritual,
        }),
      );
      sortOrder += 1;
    }

    for (const slot of input.resolvedDay.slots) {
      const seance = lessonAssembler.findSeanceForSlot(
        input.seances,
        slot,
        input.resolvedDay.date,
      );
      const inlineRitual = ritualAssembler.attachRitualToSlot(rituals, slot);

      if (inlineRitual) {
        entries.push(
          buildRitualEntry({
            journalId: input.journalId,
            sortOrder,
            ritual: inlineRitual,
          }),
        );
        sortOrder += 1;
      }

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
