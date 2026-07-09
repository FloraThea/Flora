import { askThea } from "@/lib/thea/services/gemini";
import { buildTheaInstructionBlock, loadTeacherProfileForGeneration } from "@/lib/profile";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import { supabase } from "@/lib/supabase";
import type { ReferentielCompetence } from "@/lib/programming/types";
import { loadProgression } from "@/lib/progression/progression-service";
import type { ProgressionRow, ProgressionTab } from "@/lib/progression/types";
import { competenceAnalyzer } from "./CompetenceAnalyzer";
import { differentiationEngine } from "./DifferentiationEngine";
import { evaluationPlanner } from "./EvaluationPlanner";
import { learningScenarioBuilder } from "./LearningScenarioBuilder";
import { buildSequencePrompt, parseSequenceEnrichment } from "./prompts/generateSequence";
import { resourcePlanner } from "./ResourcePlanner";
import type { SequenceContext, SequenceDraft, SequenceGenerationInput } from "./types";

const CYCLE1_LEVELS = new Set(["PS", "MS", "GS"]);
const CYCLE2_LEVELS = new Set(["CP", "CE1", "CE2"]);
const CYCLE3_LEVELS = new Set(["CM1", "CM2", "6EME", "6ÈME", "6ème"]);

function deriveCycleFromLevels(levels: string[]): string {
  const normalized = levels.map((level) => level.trim().toUpperCase());
  if (normalized.some((level) => CYCLE1_LEVELS.has(level))) return "Cycle 1";
  if (normalized.some((level) => CYCLE3_LEVELS.has(level))) return "Cycle 3";
  if (normalized.some((level) => CYCLE2_LEVELS.has(level))) return "Cycle 2";
  return "Cycle 2";
}

async function loadReferentiel(
  ids: string[],
  matiere: string,
  levels: string[],
): Promise<ReferentielCompetence[]> {
  return loadReferentielCompetences({
    ids: ids.length > 0 ? ids : undefined,
    matiere,
    levels,
    cycle: deriveCycleFromLevels(levels),
    label: "sequences",
    requireBoDocument: ids.length === 0,
  });
}

async function findRowContext(
  progressionRowId: string,
): Promise<{ row: ProgressionRow; tab: ProgressionTab; progressionId: string } | null> {
  const { data: rowData } = await supabase
    .from("progression_rows")
    .select("*")
    .eq("id", progressionRowId)
    .single();

  if (!rowData) return null;

  const { data: tabData } = await supabase
    .from("progression_tabs")
    .select("*")
    .eq("id", rowData.tab_id)
    .single();

  if (!tabData) return null;

  const row: ProgressionRow = {
    id: rowData.id,
    sortOrder: rowData.sort_order,
    periodNumber: rowData.period_number,
    weekNumber: rowData.week_number,
    sessionNumber: rowData.session_number,
    sequenceModule: rowData.sequence_module,
    seanceLabel: rowData.seance_label,
    competenceBo: rowData.competence_bo,
    objectifs: (rowData.objectifs as string[]) ?? [],
    deroulement: rowData.deroulement,
    materiel: (rowData.materiel as string[]) ?? [],
    resources: (rowData.resources as string[]) ?? [],
    remarques: rowData.remarques,
    commentaires: rowData.commentaires,
    programmingTableId: rowData.programming_table_id ?? undefined,
    programmingPeriodId: rowData.programming_period_id ?? undefined,
    programmingCellId: rowData.programming_cell_id ?? undefined,
    referentielIds: (rowData.referentiel_ids as string[]) ?? [],
    resourceIds: (rowData.resource_ids as string[]) ?? [],
    metadata: (rowData.metadata as Record<string, unknown>) ?? {},
  };

  const tab: ProgressionTab = {
    id: tabData.id,
    programmingTableId: tabData.programming_table_id ?? undefined,
    subjectKey: tabData.subject_key,
    subjectLabel: tabData.subject_label,
    subSubjectLabel: tabData.sub_subject_label,
    accent: tabData.accent as ProgressionTab["accent"],
    sortOrder: tabData.sort_order,
    rows: [row],
  };

  return {
    row,
    tab,
    progressionId: rowData.progression_id,
  };
}

/**
 * Génère une séquence complète à partir d'une ligne de progression validée.
 */
export class SequenceGenerator {
  async buildContext(input: SequenceGenerationInput): Promise<SequenceContext> {
    const located = await findRowContext(input.progressionRowId);
    if (!located) {
      throw new Error("Ligne de progression introuvable.");
    }

    const payload = await loadProgression(located.progressionId);
    if (!payload) {
      throw new Error("Progression introuvable.");
    }

    if (payload.progression.status !== "validated") {
      throw new Error("Seule une progression validée peut générer une séquence.");
    }

    const methode = payload.progression.methode || payload.programmation.methode;

    const programmation = payload.programmation;

    return {
      progression: payload.progression,
      tab: located.tab,
      row: located.row,
      referentiel: await loadReferentiel(
        located.row.referentielIds,
        located.tab.subjectLabel,
        programmation.levels,
      ),
      resources: [],
      methode,
      cycle: deriveCycleFromLevels(programmation.levels),
      niveau: programmation.levels[0] ?? "CE2",
      schoolYear: programmation.school_year,
    };
  }

  async generate(input: SequenceGenerationInput): Promise<{
    draft: SequenceDraft;
    context: SequenceContext;
  }> {
    const teacherProfile = await loadTeacherProfileForGeneration();
    const profileInstructions = buildTheaInstructionBlock(teacherProfile);
    const context = await this.buildContext(input);
    const competence = competenceAnalyzer.analyze(context);
    const resources = await resourcePlanner.plan(context);
    const scenario = learningScenarioBuilder.buildSessions(context);
    const evaluation = evaluationPlanner.plan(context, scenario.sessionCount);
    const differentiation = differentiationEngine.build(context);

    let draft: SequenceDraft = {
      title: `${context.tab.subSubjectLabel || context.tab.subjectLabel} — P${context.row.periodNumber} S${context.row.weekNumber}`,
      matiere: context.tab.subjectLabel,
      sousMatiere: context.tab.subSubjectLabel || context.tab.subjectLabel,
      cycle: context.cycle,
      niveau: context.niveau,
      periodNumber: context.row.periodNumber,
      weekNumbers: [context.row.weekNumber],
      competenceBo: competence.competenceBo,
      attendus: competence.attendus,
      objectifs: context.row.objectifs.length ? context.row.objectifs : [context.row.deroulement].filter(Boolean),
      dureeEstimeeMinutes: scenario.dureeEstimeeMinutes,
      sessionCount: scenario.sessionCount,
      prerequis: competence.prerequis,
      notions: context.row.objectifs.filter((objectif) => !/pr[eé]requis/i.test(objectif)),
      vocabulaire: resources.vocabulaire,
      materiel: resources.materiel,
      resources: resources.resources,
      methode: context.methode,
      evaluationFinale: evaluation.evaluationFinale,
      differentiation,
      prolongements: context.row.remarques ? [context.row.remarques] : [],
      referentielIds: competence.referentielIds,
      resourceIds: resources.resourceIds.length ? resources.resourceIds : context.row.resourceIds,
      sessions: scenario.sessions,
      evaluations: evaluation.evaluations,
    };

    try {
      const prompt = buildSequencePrompt(context, draft, profileInstructions);
      const raw = await askThea(prompt);
      draft = parseSequenceEnrichment(raw, draft);
    } catch (error) {
      console.error("Enrichissement Théa séquence :", error);
    }

    return { draft, context };
  }
}

export const sequenceGenerator = new SequenceGenerator();
