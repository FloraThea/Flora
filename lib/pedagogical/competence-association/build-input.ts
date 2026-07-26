import type { PedagogicalContentInput, PedagogicalEntityType } from "./types";

export function buildAssociationInputFromProgressionRow(input: {
  row: {
    sequenceModule?: string;
    seanceLabel?: string;
    competenceBo?: string;
    objectifs?: string[];
    deroulement?: string;
    materiel?: string[];
    resources?: string[];
    metadata?: Record<string, unknown>;
  };
  matiere: string;
  niveau?: string;
  cycle?: string;
  sousMatiere?: string;
  methode?: string;
  libraryContent?: string;
  entityId?: string;
}): PedagogicalContentInput {
  return {
    entityType: "progression_row",
    entityId: input.entityId,
    matiere: input.matiere,
    niveau: input.niveau,
    cycle: input.cycle,
    sousMatiere: input.sousMatiere,
    methode: input.methode,
    moduleLabel: input.row.sequenceModule,
    seanceLabel: input.row.seanceLabel,
    competences: input.row.competenceBo ? [input.row.competenceBo] : [],
    objectifs: input.row.objectifs ?? [],
    deroulement: input.row.deroulement ?? "",
    materiel: input.row.materiel ?? [],
    ressources: input.row.resources ?? [],
    libraryContent: input.libraryContent,
    title: input.row.seanceLabel || input.row.sequenceModule,
  };
}

export function buildAssociationInputFromImportedRow(input: {
  row: {
    sequence?: string;
    seance?: string;
    objectif?: string;
    competences?: string[];
    notions?: string[];
    materiel?: string[];
    ressources?: string[];
    deroulement?: string;
    evaluation?: string;
    differenciation?: string;
    domaine?: string;
  };
  matiere: string;
  niveau?: string;
  methode?: string;
}): PedagogicalContentInput {
  return {
    entityType: "import",
    matiere: input.matiere,
    niveau: input.niveau,
    methode: input.methode,
    sousMatiere: input.row.domaine,
    title: input.row.seance || input.row.sequence,
    moduleLabel: input.row.sequence,
    seanceLabel: input.row.seance,
    objectifs: input.row.objectif ? [input.row.objectif] : [],
    competences: input.row.competences ?? [],
    notions: input.row.notions ?? [],
    deroulement: input.row.deroulement ?? "",
    materiel: input.row.materiel ?? [],
    ressources: input.row.ressources ?? [],
    evaluation: input.row.evaluation,
    differenciation: input.row.differenciation,
  };
}

export function buildAssociationInputFromSequenceDraft(input: {
  draft: {
    title?: string;
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    cycle?: string;
    competenceBo?: string;
    objectifs?: string[];
    notions?: string[];
    materiel?: string[];
    methode?: string;
  };
  row?: {
    sequenceModule?: string;
    seanceLabel?: string;
    deroulement?: string;
    objectifs?: string[];
  };
  libraryContent?: string;
  entityId?: string;
}): PedagogicalContentInput {
  return {
    entityType: "sequence",
    entityId: input.entityId,
    title: input.draft.title,
    matiere: input.draft.matiere ?? "",
    sousMatiere: input.draft.sousMatiere,
    niveau: input.draft.niveau,
    cycle: input.draft.cycle,
    methode: input.draft.methode,
    moduleLabel: input.row?.sequenceModule,
    seanceLabel: input.row?.seanceLabel,
    competences: input.draft.competenceBo ? [input.draft.competenceBo] : [],
    objectifs: input.draft.objectifs?.length ? input.draft.objectifs : input.row?.objectifs,
    notions: input.draft.notions,
    deroulement: input.row?.deroulement,
    materiel: input.draft.materiel,
    libraryContent: input.libraryContent,
  };
}

export function buildAssociationInputFromSeanceDraft(input: {
  draft: {
    title?: string;
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    cycle?: string;
    competenceBo?: string;
    objectif?: string;
    methode?: string;
    phases?: Array<{ summary?: string; activities?: Array<{ objectif?: string; consignesEnseignant?: string }> }>;
  };
  progressionRow?: {
    sequenceModule?: string;
    seanceLabel?: string;
    objectifs?: string[];
    deroulement?: string;
  };
  libraryContent?: string;
  entityId?: string;
}): PedagogicalContentInput {
  const activites =
    input.draft.phases?.flatMap((phase) =>
      (phase.activities ?? []).flatMap((activity) =>
        [activity.objectif, activity.consignesEnseignant].filter(Boolean) as string[],
      ),
    ) ?? [];

  return {
    entityType: "seance",
    entityId: input.entityId,
    title: input.draft.title,
    matiere: input.draft.matiere ?? "",
    sousMatiere: input.draft.sousMatiere,
    niveau: input.draft.niveau,
    cycle: input.draft.cycle,
    methode: input.draft.methode,
    moduleLabel: input.progressionRow?.sequenceModule,
    seanceLabel: input.progressionRow?.seanceLabel,
    competences: input.draft.competenceBo ? [input.draft.competenceBo] : [],
    objectifs: [
      ...(input.draft.objectif ? [input.draft.objectif] : []),
      ...(input.progressionRow?.objectifs ?? []),
    ],
    deroulement: input.progressionRow?.deroulement,
    activites,
    libraryContent: input.libraryContent,
  };
}

export function inferEntityType(value: string | undefined): PedagogicalEntityType {
  switch (value) {
    case "programmation":
    case "programming_cell":
    case "progression_row":
    case "sequence":
    case "seance":
    case "module":
    case "import":
      return value;
    default:
      return "seance";
  }
}
