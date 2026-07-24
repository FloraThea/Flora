import type { StoredSeance } from "@/lib/seances/types";
import type { TimetableSlot } from "@/lib/programming/types";
import type { JournalEntry, JournalMateriel, JournalResources } from "./types";
import { scheduleEngine } from "./ScheduleEngine";

function flattenMateriel(seance: StoredSeance): JournalMateriel {
  const materiel = seance.materiel;
  const items = [
    ...materiel.guides,
    ...materiel.albums,
    ...materiel.affichages,
    ...materiel.manipulation,
    ...materiel.videoprojecteur,
    ...materiel.photocopies,
    ...materiel.fiches,
    ...materiel.cartes,
    ...materiel.jeux,
    ...materiel.autres,
  ];

  return {
    items,
    guides: materiel.guides,
    albums: materiel.albums,
    fiches: materiel.fiches,
    jeux: materiel.jeux,
    autres: materiel.autres,
  };
}

function resourcesFromSeance(seance: StoredSeance, libraryResources?: JournalResources): JournalResources {
  return {
    guides: libraryResources?.guides ?? seance.materiel.guides,
    albums: libraryResources?.albums ?? seance.materiel.albums,
    fiches: libraryResources?.fiches ?? seance.materiel.fiches,
    documents: libraryResources?.documents ?? seance.resources,
    jeux: libraryResources?.jeux ?? seance.materiel.jeux,
    videos: libraryResources?.videos ?? [],
    numeriques: libraryResources?.numeriques ?? seance.materiel.videoprojecteur,
    liens: libraryResources?.liens ?? [],
  };
}

export class LessonAssembler {
  findSeanceForSlot(seances: StoredSeance[], slot: TimetableSlot, date: string): StoredSeance | null {
    const byDate = seances.find(
      (seance) =>
        seance.sessionDate === date &&
        seance.matiere.toLowerCase() === slot.subject.toLowerCase(),
    );
    if (byDate) return byDate;

    return (
      seances.find((seance) => seance.matiere.toLowerCase() === slot.subject.toLowerCase()) ?? null
    );
  }

  buildEntryFromSeance(input: {
    journalId: string;
    sortOrder: number;
    slot: TimetableSlot;
    seance: StoredSeance;
    libraryResources?: JournalResources;
  }): Omit<JournalEntry, "id" | "observation"> {
    const dureeMinutes =
      input.seance.dureeMinutes || scheduleEngine.estimateSlotMinutes(input.slot);

    return {
      journalId: input.journalId,
      sortOrder: input.sortOrder,
      entryType: "slot",
      startTime: input.slot.start,
      endTime: input.slot.end,
      matiere: input.seance.matiere || input.slot.subject,
      seanceId: input.seance.id,
      ritualId: null,
      ritualLabel: "",
      competence: input.seance.competenceBo,
      objectif: input.seance.objectif,
      dureeMinutes,
      organisation: input.seance.pedagogicalChoices.join(" · "),
      materiel: flattenMateriel(input.seance),
      documents: input.seance.resources,
      resources: resourcesFromSeance(input.seance, input.libraryResources),
      observations: "",
      slotData: {
        sousMatiere: input.seance.sousMatiere,
        sequenceId: input.seance.sequenceId,
        progressionId: input.seance.progressionId,
        progressionRowId: input.seance.progressionRowId,
        differentiation: input.seance.differentiation,
        groupesBesoins: input.seance.differentiation.groupesBesoins,
        adaptations: input.seance.differentiation.adaptations,
        variantes: input.seance.differentiation.variantes,
      },
      metadata: {
        source: "seances",
        fillState: "generated",
        isPersisted: true,
        seanceTitle: input.seance.title,
        elevesFragiles: input.seance.differentiation.elevesFragiles,
        elevesAvances: input.seance.differentiation.elevesAvances,
        sourceDocumentId: input.seance.metadata?.sourceDocumentId,
        sourceDocumentTitle: input.seance.metadata?.sourceDocumentTitle,
        sourcePath: input.seance.metadata?.sourcePath,
        sourceEntityId: input.seance.metadata?.sourceEntityId,
      },
    };
  }

  buildEmptySlotEntry(input: {
    journalId: string;
    sortOrder: number;
    slot: TimetableSlot & {
      slotType?: string;
      subSubject?: string;
      customText?: string;
      color?: string;
      sourceScheduleSlotId?: string;
    };
  }): Omit<JournalEntry, "id" | "observation"> {
    const slotType = input.slot.slotType ?? "seance";
    const entryType =
      slotType === "rituel" ? "ritual" : slotType === "recreation" || slotType === "pause_meridienne" ? "break" : "slot";

    return {
      journalId: input.journalId,
      sortOrder: input.sortOrder,
      entryType,
      startTime: input.slot.start,
      endTime: input.slot.end,
      matiere: input.slot.subject,
      seanceId: null,
      ritualId: null,
      ritualLabel: entryType === "ritual" ? input.slot.subject : "",
      competence: "",
      objectif: "",
      dureeMinutes: this.estimateMinutes(input.slot),
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
        slotType,
        subSubject: input.slot.subSubject ?? "",
        customText: input.slot.customText ?? "",
        color: input.slot.color ?? "",
        sourceScheduleSlotId: input.slot.sourceScheduleSlotId ?? null,
      },
      metadata: {
        source: "timetable",
        fillState: "empty",
        isPersisted: false,
      },
    };
  }

  estimateMinutes(slot: TimetableSlot): number {
    return scheduleEngine.estimateSlotMinutes(slot);
  }
}

export const lessonAssembler = new LessonAssembler();
