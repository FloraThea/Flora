import { askThea } from "@/lib/thea/services/gemini";
import {
  buildTheaInstructionBlock,
  getPrimaryMethod,
  loadTeacherProfileForGeneration,
} from "@/lib/profile";
import { loadProgrammation } from "@/lib/programming/programmation-service";
import { inferCycleFromLevels } from "@/lib/referentiel/bo-cycle-utils";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import { supabase } from "@/lib/supabase";
import type { ReferentielCompetence, ResourceContext } from "@/lib/programming/types";
import { competenceSequencer } from "./CompetenceSequencer";
import { learningPathEngine } from "./LearningPathEngine";
import { buildProgressionPrompt, parseProgressionEnrichment } from "./prompts/generateProgression";
import type {
  ProgressionContext,
  ProgressionGenerationInput,
  ProgressionTab,
} from "./types";
import { weeklyPlanner } from "./WeeklyPlanner";

async function loadReferentiel(
  levels: string[],
  matiere: string,
): Promise<ReferentielCompetence[]> {
  return loadReferentielCompetences({
    levels,
    matiere,
    cycle: inferCycleFromLevels(levels),
    label: "progression",
    requireBoDocument: true,
  });
}

async function loadResources(methode: string): Promise<ResourceContext[]> {
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, matiere, methode, document_type")
    .eq("status", "analysed");

  const resources: ResourceContext[] = [];

  for (const document of documents ?? []) {
    const metadata = (document as { metadata?: Record<string, unknown> }).metadata;
    if (metadata?.archived) continue;
    if (methode && !String(document.methode ?? "").toLowerCase().includes(methode.toLowerCase())) {
      continue;
    }

    const [{ data: competences }, { data: entities }] = await Promise.all([
      supabase.from("document_competences").select("competence").eq("document_id", document.id),
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
        .map((item) => item.label),
      modules: (entities ?? [])
        .filter((item) => item.entity_type === "module")
        .map((item) => item.label),
    });
  }

  return resources;
}

/**
 * Génère une progression annuelle à partir d'une programmation validée.
 */
export class ProgressionGenerator {
  async buildContext(input: ProgressionGenerationInput): Promise<ProgressionContext> {
    const programmation = await loadProgrammation(input.programmationId);

    if (!programmation) {
      throw new Error("Programmation introuvable.");
    }

    if (programmation.programmation.status !== "validated") {
      throw new Error("Seule une programmation validée peut générer une progression.");
    }

    const methode = input.methode || programmation.programmation.methode;

    return {
      programmation,
      referentiel: await loadReferentiel(
        programmation.programmation.levels,
        programmation.programmation.matiere,
      ),
      resources: await loadResources(methode),
      calendar: programmation.programmation.calendar_snapshot,
      timetable: programmation.programmation.timetable,
      methode,
    };
  }

  async generate(input: ProgressionGenerationInput): Promise<{
    title: string;
    tabs: ProgressionTab[];
    context: ProgressionContext;
  }> {
    const teacherProfile = await loadTeacherProfileForGeneration();
    const profileInstructions = buildTheaInstructionBlock(teacherProfile);
    const enrichedInput: ProgressionGenerationInput = {
      ...input,
      methode: input.methode || getPrimaryMethod(teacherProfile),
    };
    const context = await this.buildContext(enrichedInput);
    const tabs: ProgressionTab[] = [];

    for (const table of context.programmation.tables) {
      const rawPaths = learningPathEngine.buildPathsForTable(
        table,
        context.methode,
        context,
      );

      const sequencedPaths = new Map<number, ReturnType<typeof competenceSequencer.sequence>>();
      rawPaths.forEach((items, periodNumber) => {
        sequencedPaths.set(
          periodNumber,
          competenceSequencer.sequence(items, context.referentiel),
        );
      });

      let rows = weeklyPlanner.planTableRows(table, sequencedPaths, context);

      try {
        const prompt = buildProgressionPrompt(context, table, rows, profileInstructions);
        const raw = await askThea(prompt);
        rows = parseProgressionEnrichment(raw, rows);
      } catch (error) {
        console.error("Enrichissement Théa progression :", error);
      }

      tabs.push({
        programmingTableId: table.id,
        subjectKey: table.subjectKey,
        subjectLabel: table.subjectLabel,
        subSubjectLabel: table.subSubjectLabel,
        accent: table.accent,
        sortOrder: table.sortOrder,
        rows: rows.map((row, index) => ({
          ...row,
          id: `draft-${table.subjectKey}-${index}`,
          sortOrder: index,
        })),
      });
    }

    return {
      title: `Progression — ${context.programmation.programmation.title}`,
      tabs,
      context,
    };
  }
}

export const progressionGenerator = new ProgressionGenerator();
