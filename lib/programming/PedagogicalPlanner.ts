import { supabase } from "@/lib/supabase";
import {
  getImportedDisciplines,
  loadReferentielCompetences,
} from "@/lib/referentiel/referentiel-service";
import { inferCycleFromLevels } from "@/lib/referentiel/bo-cycle-utils";
import {
  getActiveBoDocument,
  getLatestReadyBoDocument,
} from "@/lib/referentiel/bo-document-service";
import type { FloraAccent } from "@/lib/theme";
import {
  FRENCH_SUB_SUBJECTS,
  MATH_SUB_SUBJECTS,
  OTHER_SUBJECTS,
} from "./types";
import type {
  CalendarSnapshot,
  PlannerContext,
  ProgrammingCellContent,
  ProgrammingGenerationInput,
  ProgrammingPeriodColumn,
  ProgrammingTable,
  ReferentielCompetence,
  ResourceContext,
} from "./types";
import { schoolWeeksCalculator } from "./SchoolWeeksCalculator";

const ACCENTS: FloraAccent[] = ["rose", "lavender", "sage", "peach", "cream"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function emptyCell(): ProgrammingCellContent {
  return {
    competences: [],
    notions: [],
    resources: [],
    guides: [],
    modules: [],
    content: "",
  };
}

/**
 * Rassemble BO, ressources importées et calendrier pour alimenter la génération.
 */
export class PedagogicalPlanner {
  async buildContext(input: ProgrammingGenerationInput): Promise<PlannerContext> {
    const calendar = schoolWeeksCalculator.calculate(
      input.schoolYear,
      input.academicZone,
      {
        includeBridgeDays: input.includeBridgeDays,
        teacherWorkingDays: input.teacherWorkingDays,
      },
    );

    const cycle = inferCycleFromLevels(input.levels);

    const boDocument =
      (await getActiveBoDocument(input.matiere, cycle)) ??
      (await getLatestReadyBoDocument(input.matiere, cycle));

    const [referentiel, resources] = await Promise.all([
      loadReferentielCompetences({
        levels: input.levels,
        matiere: input.matiere,
        cycle,
        label: "programmation",
        requireBoDocument: Boolean(boDocument),
        documentSourceId: boDocument?.id ?? null,
      }),
      this.loadResources(input.matiere, input.methode),
    ]);

    return {
      referentiel,
      resources,
      calendar,
      timetable: input.timetable,
      boDocumentId: boDocument?.id ?? null,
    };
  }

  buildTableSkeletons(
    input: ProgrammingGenerationInput,
    calendar: CalendarSnapshot,
    referentiel: ReferentielCompetence[] = [],
    boDocumentId: string | null = null,
  ): ProgrammingTable[] {
    const tables: ProgrammingTable[] = [];
    let sortOrder = 0;
    const importedDisciplines = getImportedDisciplines(referentiel);

    const pushTable = (subjectLabel: string, subSubjectLabel: string) => {
      tables.push({
        subjectKey: slugify(`${subjectLabel}_${subSubjectLabel || subjectLabel}`),
        subjectLabel,
        subSubjectLabel,
        accent: ACCENTS[sortOrder % ACCENTS.length],
        sortOrder,
        periods: calendar.periods.map((period) => ({
          periodNumber: period.periodNumber,
          label: period.label,
          weekCount: period.classWeeks,
          startDate: period.startDate,
          endDate: period.endDate,
          cell: emptyCell(),
        })),
      });
      sortOrder += 1;
    };

    const pushDisciplineTables = (discipline: string) => {
      const disciplineRows = referentiel.filter(
        (row) =>
          row.discipline === discipline ||
          String(row.discipline ?? "")
            .toLowerCase()
            .includes(discipline.toLowerCase()),
      );

      if (discipline === "Français") {
        const boSections = [
          ...new Set(
            disciplineRows.map((row) => row.section ?? row.domaine).filter(Boolean),
          ),
        ] as string[];

        const subSubjects = boSections.length > 0 ? boSections : [...FRENCH_SUB_SUBJECTS];
        for (const subSubject of subSubjects) {
          pushTable("Français", subSubject);
        }
        return;
      }

      if (discipline === "Mathématiques") {
        const boDomains = [
          ...new Set(disciplineRows.map((row) => row.domaine).filter(Boolean)),
        ] as string[];

        const subSubjects = boDomains.length > 0 ? boDomains : [...MATH_SUB_SUBJECTS];
        for (const subSubject of subSubjects) {
          pushTable("Mathématiques", subSubject);
        }
        return;
      }

      const domains = [
        ...new Set(
          referentiel
            .filter((row) => row.discipline === discipline)
            .map((row) => row.domaine)
            .filter(Boolean),
        ),
      ] as string[];

      if (domains.length > 0) {
        for (const domain of domains) {
          pushTable(discipline, domain);
        }
        return;
      }

      pushTable(discipline, "");
    };

    if (importedDisciplines.length > 0) {
      console.info("[programmation] Référentiel BO importé détecté", {
        disciplines: importedDisciplines,
        rows: referentiel.length,
      });

      if (input.matiere === "Toutes les matières") {
        for (const discipline of importedDisciplines) {
          pushDisciplineTables(discipline);
        }
        return tables;
      }

      const selectedDiscipline = importedDisciplines.find(
        (discipline) =>
          discipline.toLowerCase().includes(input.matiere.toLowerCase()) ||
          input.matiere.toLowerCase().includes(discipline.toLowerCase()),
      );

      if (selectedDiscipline) {
        pushDisciplineTables(selectedDiscipline);
        return tables;
      }

      console.warn("[programmation] Matière demandée absente du référentiel importé", {
        matiere: input.matiere,
        importedDisciplines,
      });
      return tables;
    }

    if (boDocumentId) {
      console.warn("[programmation] Document BO actif sans compétences filtrées — pas de gabarit générique", {
        boDocumentId,
        matiere: input.matiere,
      });
      return tables;
    }

    if (input.matiere === "Français") {
      for (const subSubject of FRENCH_SUB_SUBJECTS) {
        pushTable("Français", subSubject);
      }
    } else if (input.matiere === "Mathématiques") {
      for (const subSubject of MATH_SUB_SUBJECTS) {
        pushTable("Mathématiques", subSubject);
      }
    } else if (input.matiere === "Toutes les matières") {
      for (const subSubject of FRENCH_SUB_SUBJECTS) {
        pushTable("Français", subSubject);
      }
      for (const subSubject of MATH_SUB_SUBJECTS) {
        pushTable("Mathématiques", subSubject);
      }
      for (const subject of OTHER_SUBJECTS) {
        pushTable(subject, "");
      }
    } else {
      pushTable(input.matiere, "");
    }

    return tables;
  }

  private async loadResources(
    matiere: string,
    methode: string,
  ): Promise<ResourceContext[]> {
    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, title, matiere, methode, document_type, resume")
      .eq("status", "analysed");

    if (error || !documents) {
      console.error("Erreur chargement ressources :", error);
      return [];
    }

    const filtered = documents.filter((document) => {
      const metadata = (document as { metadata?: Record<string, unknown> }).metadata;
      if (metadata?.archived) return false;

      const matchesMatiere =
        matiere === "Toutes les matières" ||
        !matiere ||
        String(document.matiere ?? "").toLowerCase().includes(matiere.toLowerCase());
      const matchesMethode =
        !methode || String(document.methode ?? "").toLowerCase().includes(methode.toLowerCase());

      return matchesMatiere || matchesMethode;
    });

    const resources: ResourceContext[] = [];

    for (const document of filtered) {
      const [{ data: competences }, { data: entities }] = await Promise.all([
        supabase
          .from("document_competences")
          .select("competence")
          .eq("document_id", document.id),
        supabase
          .from("pedagogical_entities")
          .select("label, entity_type")
          .eq("document_id", document.id),
      ]);

      resources.push({
        documentId: document.id,
        title: document.title || "Ressource",
        matiere: document.matiere ?? "",
        methode: document.methode ?? "",
        documentType: document.document_type ?? "",
        competences: (competences ?? []).map((item) => item.competence).filter(Boolean),
        notions: (entities ?? [])
          .filter((item) => item.entity_type === "notion")
          .map((item) => item.label)
          .filter(Boolean),
        modules: (entities ?? [])
          .filter((item) => item.entity_type === "module")
          .map((item) => item.label)
          .filter(Boolean),
      });
    }

    return resources;
  }
}

export const pedagogicalPlanner = new PedagogicalPlanner();

export function mergeGeneratedCells(
  tables: ProgrammingTable[],
  generated: Array<{
    subjectKey: string;
    periods: Array<{
      periodNumber: number;
      competences?: string[];
      notions?: string[];
      resources?: string[];
      guides?: string[];
      modules?: string[];
      content?: string;
    }>;
  }>,
): ProgrammingTable[] {
  return tables.map((table) => {
    const generatedTable = generated.find(
      (item) => item.subjectKey === table.subjectKey,
    );

    if (!generatedTable) return table;

    return {
      ...table,
      periods: table.periods.map((period): ProgrammingPeriodColumn => {
        const generatedPeriod = generatedTable.periods.find(
          (item) => item.periodNumber === period.periodNumber,
        );

        if (!generatedPeriod) return period;

        return {
          ...period,
          cell: {
            competences: generatedPeriod.competences ?? [],
            notions: generatedPeriod.notions ?? [],
            resources: generatedPeriod.resources ?? [],
            guides: generatedPeriod.guides ?? [],
            modules: generatedPeriod.modules ?? [],
            content: generatedPeriod.content ?? "",
          },
        };
      }),
    };
  });
}
