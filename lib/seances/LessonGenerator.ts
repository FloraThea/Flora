import { askThea } from "@/lib/thea/services/gemini";
import { buildTheaInstructionBlock, loadTeacherProfileForGeneration } from "@/lib/profile";
import { loadProgrammation } from "@/lib/programming/programmation-service";
import { inferCycleFromLevels } from "@/lib/referentiel/bo-cycle-utils";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import { loadLibraryResourcesForGeneration, findLibraryEntityMatches, buildProvenanceMetadata } from "@/lib/pedagogical/library-context";
import { floraDb } from "@/lib/supabase/get-db";
import { loadSequence } from "@/lib/sequences/sequence-service";
import type { ProgressionRow } from "@/lib/progression/types";
import type { ReferentielCompetence, ResourceContext } from "@/lib/programming/types";
import { activityGenerator } from "./ActivityGenerator";
import { assessmentPlanner } from "./AssessmentPlanner";
import { differentiationEngine } from "./DifferentiationEngine";
import { homeworkGenerator } from "./HomeworkGenerator";
import { lessonPlanner } from "./LessonPlanner";
import { materialPlanner } from "./MaterialPlanner";
import { buildSeancePrompt, parseSeanceEnrichment } from "./prompts/generateSeance";
import { saveSeance } from "./seance-service";
import { traceEcriteGenerator } from "./TraceEcriteGenerator";
import type { SeanceContext, SeanceDraft, SeanceGenerationInput, SeancePayload } from "./types";

async function loadReferentiel(
  ids: string[],
  matiere: string,
  levels: string[],
): Promise<ReferentielCompetence[]> {
  return loadReferentielCompetences({
    ids: ids.length > 0 ? ids : undefined,
    matiere,
    levels,
    cycle: inferCycleFromLevels(levels),
    label: "seances",
    requireBoDocument: ids.length === 0,
  });
}

async function loadResources(
  resourceIds: string[],
  methode: string,
  matiere: string,
  moduleLabel?: string,
  seanceLabel?: string,
  sourcePath?: string,
): Promise<ResourceContext[]> {
  return loadLibraryResourcesForGeneration({
    resourceIds: resourceIds.length > 0 ? resourceIds : undefined,
    methode,
    matiere,
    moduleLabel,
    seanceLabel,
    sourcePath,
  });
}

async function loadProgressionRow(rowId: string): Promise<ProgressionRow | null> {
  const { data } = await (await floraDb()).from("progression_rows").select("*").eq("id", rowId).single();
  if (!data) return null;

  return {
    id: data.id,
    sortOrder: data.sort_order,
    periodNumber: data.period_number,
    weekNumber: data.week_number,
    sessionNumber: data.session_number,
    sequenceModule: data.sequence_module,
    seanceLabel: data.seance_label,
    competenceBo: data.competence_bo,
    objectifs: (data.objectifs as string[]) ?? [],
    deroulement: data.deroulement,
    materiel: (data.materiel as string[]) ?? [],
    resources: (data.resources as string[]) ?? [],
    remarques: data.remarques,
    commentaires: data.commentaires,
    programmingTableId: data.programming_table_id ?? undefined,
    programmingPeriodId: data.programming_period_id ?? undefined,
    programmingCellId: data.programming_cell_id ?? undefined,
    referentielIds: (data.referentiel_ids as string[]) ?? [],
    resourceIds: (data.resource_ids as string[]) ?? [],
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Génère une séance détaillée à partir d'une session de séquence.
 */
export class LessonGenerator {
  async buildContext(sequenceSessionId: string): Promise<SeanceContext> {
    const teacherProfile = await loadTeacherProfileForGeneration();

    const { data: sessionRow } = await (await floraDb())
      .from("sequence_sessions")
      .select("*")
      .eq("id", sequenceSessionId)
      .single();

    if (!sessionRow) {
      throw new Error("Session de séquence introuvable.");
    }

    const sequencePayload = await loadSequence(String(sessionRow.sequence_id));
    if (!sequencePayload) {
      throw new Error("Séquence introuvable.");
    }

    const progressionRowId = sequencePayload.sequence.progression_row_id;
    if (!progressionRowId) {
      throw new Error(
        "Cette séquence est indépendante : générez la séance via la création manuelle ou associez-la à une progression.",
      );
    }

    const progressionRow = await loadProgressionRow(progressionRowId);
    if (!progressionRow) {
      throw new Error("Ligne de progression introuvable.");
    }

    const programmationId = sequencePayload.sequence.programmation_id;
    const programmation = programmationId ? await loadProgrammation(programmationId) : null;
    const methode = sequencePayload.sequence.methode || teacherProfile.methods[0]?.methodName || "";

    const sequenceSession = sequencePayload.sessions.find((session) => session.id === sequenceSessionId);
    if (!sequenceSession) {
      throw new Error("Session absente de la séquence.");
    }

    return {
      teacherProfile,
      sequencePayload,
      sequenceSession,
      progressionRow,
      referentiel: await loadReferentiel(
        sequencePayload.sequence.referentielIds,
        sequencePayload.sequence.matiere,
        [sequencePayload.sequence.niveau],
      ),
      resources: await loadResources(
        sequencePayload.sequence.resourceIds,
        methode,
        sequencePayload.sequence.matiere,
        progressionRow.sequenceModule,
        progressionRow.seanceLabel,
        String(progressionRow.metadata?.sourcePath ?? ""),
      ),
      timetable: programmation?.programmation.timetable ?? { slots: [], weeklyHoursBySubject: {} },
      methode,
    };
  }

  buildDraft(context: SeanceContext): SeanceDraft {
    const sequence = context.sequencePayload.sequence;
    const session = context.sequenceSession;

    let phases = lessonPlanner.buildPhases(context);
    phases = activityGenerator.buildActivities(context, phases);

    return {
      title: session.title,
      matiere: sequence.matiere,
      sousMatiere: sequence.sousMatiere,
      niveau: sequence.niveau,
      cycle: sequence.cycle,
      periodNumber: sequence.periodNumber,
      weekNumber: sequence.weekNumbers[0] ?? context.progressionRow.weekNumber,
      sessionDate: null,
      dureeMinutes: session.dureeMinutes,
      competenceBo: sequence.competenceBo || context.progressionRow.competenceBo,
      objectif: session.objectif || context.progressionRow.objectifs[0] || sequence.objectifs[0] || "",
      prerequis: sequence.prerequis,
      methode: context.methode,
      resourceIds: sequence.resourceIds,
      referentielIds: sequence.referentielIds,
      resources: sequence.resources,
      materiel: materialPlanner.plan(context),
      differentiation: differentiationEngine.build(context),
      evaluation: assessmentPlanner.plan(context),
      homework: homeworkGenerator.build(context),
      traceEcrite: traceEcriteGenerator.build(context),
      pedagogicalChoices: [
        `Séance construite à partir de la séquence « ${sequence.title} ».`,
        `Méthode ${context.methode} respectée dans le déroulé.`,
        `Durée répartie sur ${phases.length} phases pédagogiques.`,
      ],
      phases,
    };
  }

  async generate(input: SeanceGenerationInput): Promise<SeancePayload | SeancePayload[]> {
    if (input.sequenceId && !input.sequenceSessionId) {
      return this.generateAllForSequence(input.sequenceId);
    }

    if (!input.sequenceSessionId) {
      throw new Error("sequenceSessionId ou sequenceId requis.");
    }

    return this.generateOne(input.sequenceSessionId);
  }

  async generateOne(sequenceSessionId: string): Promise<SeancePayload> {
    const context = await this.buildContext(sequenceSessionId);
    let draft = this.buildDraft(context);

    const libraryMatches = await findLibraryEntityMatches({
      methode: context.methode,
      matiere: context.sequencePayload.sequence.matiere,
      resourceIds: context.sequencePayload.sequence.resourceIds,
      moduleLabel: context.progressionRow.sequenceModule,
      seanceLabel: context.progressionRow.seanceLabel,
      sourcePath: String(context.progressionRow.metadata?.sourcePath ?? ""),
    });

    const libraryContent = libraryMatches
      .map((match) => match.content || match.sourceText)
      .filter(Boolean)
      .join("\n\n");

    if (libraryContent && !draft.objectif.includes(libraryContent.slice(0, 40))) {
      draft = {
        ...draft,
        objectif: draft.objectif || libraryContent.split("\n")[0] || draft.objectif,
        pedagogicalChoices: [
          ...draft.pedagogicalChoices,
          `Contenu issu de la bibliothèque : ${libraryMatches[0]?.documentTitle ?? "document source"}.`,
        ],
      };
    }

    try {
      const prompt = buildSeancePrompt(
        context,
        draft,
        buildTheaInstructionBlock(context.teacherProfile),
      );
      const raw = await askThea(prompt);
      draft = parseSeanceEnrichment(raw, draft);
    } catch (error) {
      console.error("Enrichissement Théa séance :", error);
    }

    const sequence = context.sequencePayload.sequence;

    return saveSeance({
      draft,
      sequenceSessionId,
      sequenceId: sequence.id,
      progressionId: sequence.progression_id,
      progressionRowId: sequence.progression_row_id,
      programmationId: sequence.programmation_id,
      teacherProfileId: context.teacherProfile.profile.id,
      metadata: buildProvenanceMetadata({
        matches: libraryMatches,
        moduleLabel: context.progressionRow.sequenceModule,
        seanceLabel: context.progressionRow.seanceLabel,
        sourcePath: String(context.progressionRow.metadata?.sourcePath ?? ""),
      }),
    });
  }

  async generateAllForSequence(sequenceId: string): Promise<SeancePayload[]> {
    const sequencePayload = await loadSequence(sequenceId);
    if (!sequencePayload) {
      throw new Error("Séquence introuvable.");
    }

    const payloads: SeancePayload[] = [];

    for (const session of sequencePayload.sessions) {
      if (!session.id) continue;

      const { data: existing } = await (await floraDb())
        .from("seances")
        .select("id")
        .eq("sequence_session_id", session.id)
        .maybeSingle();

      if (existing?.id) continue;

      const payload = await this.generateOne(session.id);
      payloads.push(payload);
    }

    return payloads;
  }
}

export const lessonGenerator = new LessonGenerator();
