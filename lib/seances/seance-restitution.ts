import type { ProgressionRow } from "@/lib/progression/types";
import type { SequenceSession } from "@/lib/sequences/types";
import type {
  SeanceActivity,
  SeanceDraft,
  SeanceMaterial,
  SeancePhase,
} from "./types";

function listToMaterial(items: string[]): SeanceMaterial {
  return {
    guides: items,
    albums: [],
    affichages: [],
    manipulation: [],
    videoprojecteur: [],
    photocopies: [],
    fiches: [],
    cartes: [],
    jeux: [],
    autres: [],
  };
}

function buildDeroulementContent(row: ProgressionRow): string {
  const parts: string[] = [];

  if (row.deroulement.trim()) {
    parts.push(row.deroulement.trim());
  }

  const extraObjectifs = row.objectifs.slice(1).filter(Boolean);
  if (extraObjectifs.length > 0) {
    parts.push(extraObjectifs.join("\n\n"));
  }

  if (row.commentaires.trim()) {
    parts.push(row.commentaires.trim());
  }

  return parts.join("\n\n").trim();
}

function buildPhasesFromProgressionRow(row: ProgressionRow, dureeMinutes: number): SeancePhase[] {
  const content = buildDeroulementContent(row);
  if (!content) return [];

  const activity: SeanceActivity = {
    sortOrder: 1,
    objectif: row.objectifs[0]?.trim() || row.competenceBo,
    consignesEnseignant: content,
    consignesEleves: "",
    organisation: row.remarques,
    dureeMinutes,
    variablesPedagogiques: row.resources,
    questions: [],
    reponsesAttendues: [],
    erreursFrequentes: [],
    remediations: [],
  };

  return [
    {
      sortOrder: 1,
      phaseKey: "entrainement",
      title: "Déroulement",
      dureeMinutes,
      summary: content,
      activities: [activity],
    },
  ];
}

export function shouldUseSeanceRestitution(input: {
  methode: string;
  sequenceMetadata?: Record<string, unknown>;
}): boolean {
  if (/mhm/i.test(input.methode)) return true;
  return input.sequenceMetadata?.restitutionMode === true;
}

export function buildSeanceDraftFromProgressionRow(input: {
  row: ProgressionRow;
  sequenceSession: SequenceSession;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  cycle: string;
  methode: string;
  periodNumber: number;
}): SeanceDraft {
  const sessionMeta = (input.sequenceSession.metadata ?? {}) as Record<string, unknown>;
  const rowFromSession = sessionMeta as Partial<ProgressionRow> & {
    objectifs?: string[];
    deroulement?: string;
    materiel?: string[];
    resources?: string[];
  };

  const row: ProgressionRow = {
    ...input.row,
    objectifs: (rowFromSession.objectifs as string[] | undefined) ?? input.row.objectifs,
    deroulement: String(rowFromSession.deroulement ?? input.row.deroulement ?? ""),
    materiel: (rowFromSession.materiel as string[] | undefined) ?? input.row.materiel,
    resources: (rowFromSession.resources as string[] | undefined) ?? input.row.resources,
    competenceBo: String(rowFromSession.competenceBo ?? input.row.competenceBo ?? ""),
    remarques: String(rowFromSession.remarques ?? input.row.remarques ?? ""),
    commentaires: String(rowFromSession.commentaires ?? input.row.commentaires ?? ""),
  };

  const dureeMinutes = input.sequenceSession.dureeMinutes || 45;
  const phases = buildPhasesFromProgressionRow(row, dureeMinutes);
  const materielItems = row.materiel.filter(Boolean);

  return {
    title: input.sequenceSession.title || row.seanceLabel,
    matiere: input.matiere,
    sousMatiere: input.sousMatiere,
    niveau: input.niveau,
    cycle: input.cycle,
    periodNumber: input.periodNumber,
    weekNumber: row.weekNumber,
    sessionDate: null,
    dureeMinutes,
    competenceBo: row.competenceBo,
    objectif: input.sequenceSession.objectif || row.objectifs[0] || row.deroulement,
    prerequis: [],
    methode: input.methode,
    resourceIds: row.resourceIds,
    referentielIds: row.referentielIds,
    resources: row.resources,
    materiel: listToMaterial(materielItems),
    differentiation: {
      elevesFragiles: [],
      elevesAvances: [],
      groupesBesoins: [],
      adaptations: [],
      variantes: [],
    },
    evaluation: {
      formative: "",
      criteresReussite: [],
      observables: [],
      remediations: [],
    },
    homework: {
      devoirs: [],
      revisions: [],
      lecture: [],
      entrainement: [],
    },
    traceEcrite: {
      enseignant: "",
      eleve: "",
      lecon: "",
      aideMemoire: "",
    },
    pedagogicalChoices: [],
    phases,
  };
}
