import type { BoCompetenceDraft } from "../bo-types";
import {
  buildCompetenceIdentifiant,
  expandNiveauToSchoolLevels,
  isStrictSchoolNiveau,
  normalizeSchoolNiveau,
  parseDocumentNiveaux,
  type SchoolNiveau,
} from "../niveau-utils";
import type { BoFaithfulCompetence } from "./types";

export type BoCompetenceReviewItem = {
  competence: string;
  cycle: string;
  matiere: string;
  domaine: string;
  sousDomaine: string;
  tableTitle: string;
  columnName: string;
  sourceExcerpt: string;
  sortKey: number;
  reason: string;
};

export type BoNiveauSeparationResult = {
  confirmed: BoFaithfulCompetence[];
  toReview: BoCompetenceReviewItem[];
  warnings: string[];
  competencesByNiveau: Record<string, number>;
};

function cloneWithNiveau(item: BoFaithfulCompetence, niveau: SchoolNiveau): BoFaithfulCompetence {
  return {
    ...item,
    hierarchy: {
      ...item.hierarchy,
      niveau,
    },
  };
}

function pushReview(
  list: BoCompetenceReviewItem[],
  item: BoFaithfulCompetence,
  reason: string,
): void {
  list.push({
    competence: item.competence,
    cycle: item.hierarchy.cycle,
    matiere: item.hierarchy.matiere,
    domaine: item.hierarchy.sousMatiere,
    sousDomaine: item.hierarchy.sousSousMatiere,
    tableTitle: item.tableTitle,
    columnName: item.columnName,
    sourceExcerpt: item.sourceExcerpt,
    sortKey: item.sortKey,
    reason,
  });
}

/**
 * Post-traitement : séparation stricte par niveau.
 * - Une compétence = un seul niveau (duplication si plusieurs niveaux concernés).
 * - Niveau non identifié → liste « À vérifier », jamais enregistré directement.
 */
export function finalizeCompetencesWithStrictNiveau(
  competences: BoFaithfulCompetence[],
  options: {
    cycle: string;
    documentNiveaux?: string;
    /** Niveaux actifs dans la section en cours (ex. CP+CE1+CE2 dans un tableau commun). */
    activeNiveaux?: SchoolNiveau[];
  },
): BoNiveauSeparationResult {
  const confirmed: BoFaithfulCompetence[] = [];
  const toReview: BoCompetenceReviewItem[] = [];
  const warnings: string[] = [];
  const competencesByNiveau: Record<string, number> = {};

  const documentLevels = parseDocumentNiveaux(options.documentNiveaux, options.cycle);
  let currentSectionNiveaux = options.activeNiveaux ?? [...documentLevels];

  for (const item of competences) {
    const rawNiveau = item.hierarchy.niveau.trim();
    const normalized = normalizeSchoolNiveau(rawNiveau);

    if (normalized) {
      currentSectionNiveaux = [normalized];
      confirmed.push(cloneWithNiveau(item, normalized));
      competencesByNiveau[normalized] = (competencesByNiveau[normalized] ?? 0) + 1;
      continue;
    }

    const expanded = expandNiveauToSchoolLevels(rawNiveau, item.hierarchy.cycle || options.cycle);

    if (expanded.length > 1) {
      for (const niveau of expanded) {
        confirmed.push(cloneWithNiveau(item, niveau));
        competencesByNiveau[niveau] = (competencesByNiveau[niveau] ?? 0) + 1;
      }
      continue;
    }

    if (expanded.length === 1) {
      currentSectionNiveaux = expanded;
      confirmed.push(cloneWithNiveau(item, expanded[0]));
      competencesByNiveau[expanded[0]] = (competencesByNiveau[expanded[0]] ?? 0) + 1;
      continue;
    }

    if (currentSectionNiveaux.length > 1) {
      for (const niveau of currentSectionNiveaux) {
        confirmed.push(cloneWithNiveau(item, niveau));
        competencesByNiveau[niveau] = (competencesByNiveau[niveau] ?? 0) + 1;
      }
      continue;
    }

    if (currentSectionNiveaux.length === 1) {
      const niveau = currentSectionNiveaux[0];
      confirmed.push(cloneWithNiveau(item, niveau));
      competencesByNiveau[niveau] = (competencesByNiveau[niveau] ?? 0) + 1;
      continue;
    }

    pushReview(toReview, item, "Niveau non identifié avec certitude");
  }

  const seenPerNiveau = new Map<string, Set<string>>();
  for (const item of confirmed) {
    const niveau = item.hierarchy.niveau;
    if (!isStrictSchoolNiveau(niveau)) continue;
    const key = [
      item.hierarchy.sousMatiere,
      item.hierarchy.sousSousMatiere,
      item.competence.toLowerCase(),
    ].join("|");
    const bucket = seenPerNiveau.get(niveau) ?? new Set<string>();
    bucket.add(key);
    seenPerNiveau.set(niveau, bucket);
  }

  if (toReview.length > 0) {
    warnings.push(`${toReview.length} compétence(s) placée(s) en « À vérifier » (niveau incertain).`);
  }

  return { confirmed, toReview, warnings, competencesByNiveau };
}

export function mapFaithfulCompetenceToStrictDraft(
  item: BoFaithfulCompetence,
  defaults: { matiere: string; cycle: string; documentId?: string },
): BoCompetenceDraft {
  const niveau = normalizeSchoolNiveau(item.hierarchy.niveau);
  if (!niveau) {
    throw new Error("Impossible de mapper une compétence sans niveau strict.");
  }

  const domaine = item.hierarchy.sousMatiere || item.tableTitle || defaults.matiere;
  const sousDomaine = item.hierarchy.sousSousMatiere || "";
  const objectifApprentissage =
    item.columnName === "Objectifs d'apprentissage" ? item.competence : sousDomaine || domaine;

  const identifiant = buildCompetenceIdentifiant({
    cycle: item.hierarchy.cycle || defaults.cycle,
    niveau,
    matiere: item.hierarchy.matiere || defaults.matiere,
    domaine,
    sousDomaine,
    competence: item.competence,
    sortKey: item.sortKey,
  });

  return {
    cycle: item.hierarchy.cycle || defaults.cycle,
    niveau,
    matiere: item.hierarchy.matiere || defaults.matiere,
    section: domaine,
    sectionId: "francais",
    domaine,
    sousDomaine,
    competenceType: "competence",
    competence: item.competence,
    sousCompetence: "",
    sourceExcerpt: item.sourceExcerpt,
    code: identifiant,
    objectifApprentissage,
    texteOfficiel: item.sourceExcerpt || item.competence,
    identifiant,
    tableTitle: item.tableTitle,
    columnName: item.columnName,
    tableFormat: item.tableFormat,
    reviewStatus: "confirmed",
  };
}

export function mapReviewItemToDraft(item: BoCompetenceReviewItem): BoCompetenceDraft {
  return {
    cycle: item.cycle,
    niveau: "",
    matiere: item.matiere,
    section: item.domaine || item.tableTitle,
    sectionId: "francais",
    domaine: item.domaine,
    sousDomaine: item.sousDomaine,
    competenceType: "competence",
    competence: item.competence,
    sousCompetence: "",
    sourceExcerpt: item.sourceExcerpt,
    code: "",
    objectifApprentissage: item.columnName,
    texteOfficiel: item.sourceExcerpt,
    identifiant: "",
    tableTitle: item.tableTitle,
    columnName: item.columnName,
    reviewStatus: "needs_review",
    reviewReason: item.reason,
  };
}
