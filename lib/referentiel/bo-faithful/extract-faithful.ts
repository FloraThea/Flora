import type { BoCompetenceDraft, BoSectionId } from "../bo-types";
import { resolveProgrammeKind, sectionIdFromLabel, type BoProgrammeKind } from "../bo-section-splitter";
import type { BoFaithfulCompetence, BoFaithfulExtractionResult, BoFaithfulQualityReport } from "./types";
import { extractFaithfulBoCompetences, sliceProgrammeText } from "./extract-tables";
import { findIntroductionSplitIndex } from "./normalize";
import {
  finalizeCompetencesWithStrictNiveau,
  mapFaithfulCompetenceToStrictDraft,
  mapReviewItemToDraft,
  type BoCompetenceReviewItem,
} from "./niveau-separation";

export type { BoCompetenceReviewItem };

function buildQualityReport(input: {
  introduction: string;
  structuredText: string;
  competences: BoFaithfulCompetence[];
  tables: BoFaithfulExtractionResult["quality"]["tables"];
  competencesToReview: number;
  separationWarnings: string[];
  competencesByNiveau: Record<string, number>;
}): BoFaithfulQualityReport {
  const competencesByMatiere: Record<string, number> = {};
  const competencesBySousMatiere: Record<string, number> = {};
  const competencesBySousSousMatiere: Record<string, number> = {};
  const warnings: string[] = [...input.separationWarnings];

  for (const item of input.competences) {
    const matiere = item.hierarchy.matiere || "Non précisé";
    const sousMatiere = item.hierarchy.sousMatiere || "Non précisé";
    const sousSousMatiere = item.hierarchy.sousSousMatiere || "Non précisé";

    competencesByMatiere[matiere] = (competencesByMatiere[matiere] ?? 0) + 1;
    competencesBySousMatiere[sousMatiere] = (competencesBySousMatiere[sousMatiere] ?? 0) + 1;
    competencesBySousSousMatiere[sousSousMatiere] =
      (competencesBySousSousMatiere[sousSousMatiere] ?? 0) + 1;
  }

  const emptyTables = input.tables.filter((table) => table.competencesExtracted === 0);
  if (emptyTables.length > 0) {
    warnings.push(`${emptyTables.length} tableau(x) détecté(s) sans compétence extraite.`);
  }

  if (input.competences.length === 0) {
    warnings.push("Aucune compétence extraite — vérifiez le format du BO.");
  }

  const duplicateCheck = new Set<string>();
  let duplicates = 0;
  for (const item of input.competences) {
    const key = [
      item.hierarchy.niveau,
      item.hierarchy.sousMatiere,
      item.hierarchy.sousSousMatiere,
      item.competence,
    ]
      .join("|")
      .toLowerCase();
    if (duplicateCheck.has(key)) duplicates += 1;
    duplicateCheck.add(key);
  }

  if (duplicates > 0) {
    warnings.push(`${duplicates} doublon(s) exact(s) détecté(s) et conservé(s) (ordre BO).`);
  }

  const tablesProcessed = input.tables.filter((table) => table.competencesExtracted > 0).length;

  return {
    introductionCharCount: input.introduction.length,
    structuredCharCount: input.structuredText.length,
    totalCompetences: input.competences.length,
    tablesDetected: input.tables.length,
    tablesProcessed,
    competencesByMatiere,
    competencesBySousMatiere,
    competencesBySousSousMatiere,
    competencesByNiveau: input.competencesByNiveau,
    competencesToReview: input.competencesToReview,
    tables: input.tables,
    warnings,
    passed: input.competences.length > 0,
  };
}

export function extractBoFaithfully(input: {
  text: string;
  cycle: string;
  matiere: string;
  domaine?: string;
  programme?: BoProgrammeKind;
  documentNiveaux?: string;
}): BoFaithfulExtractionResult & { toReview: BoCompetenceReviewItem[] } {
  const programme = resolveProgrammeKind({
    text: input.text,
    matiere: input.matiere,
    domaine: input.domaine,
    programme: input.programme,
  });
  const scopedText = sliceProgrammeText(input.text, programme, input.cycle);
  const splitIndex = findIntroductionSplitIndex(scopedText);
  const introduction = scopedText.slice(0, splitIndex).trim();
  const structuredText = scopedText.slice(splitIndex).trim();

  const { competences: rawCompetences, tables } = extractFaithfulBoCompetences({
    text: scopedText,
    cycle: input.cycle,
    matiere: input.matiere,
    programme,
  });

  const separation = finalizeCompetencesWithStrictNiveau(rawCompetences, {
    cycle: input.cycle,
    documentNiveaux: input.documentNiveaux,
  });

  const quality = buildQualityReport({
    introduction,
    structuredText,
    competences: separation.confirmed,
    tables,
    competencesToReview: separation.toReview.length,
    separationWarnings: separation.warnings,
    competencesByNiveau: separation.competencesByNiveau,
  });

  return {
    introduction,
    structuredText,
    competences: separation.confirmed,
    toReview: separation.toReview,
    quality,
    extractionMethod: "faithful_v1",
  };
}

export function mapFaithfulCompetenceToDraft(
  item: BoFaithfulCompetence,
  defaults: { matiere: string; cycle: string },
): BoCompetenceDraft {
  const draft = mapFaithfulCompetenceToStrictDraft(item, defaults);
  const sectionLabel = item.hierarchy.sousMatiere || item.tableTitle || defaults.matiere;
  return {
    ...draft,
    sectionId: sectionIdFromLabel(sectionLabel) as BoSectionId,
  };
}

export function mapFaithfulResultToDrafts(
  result: BoFaithfulExtractionResult & { toReview?: BoCompetenceReviewItem[] },
  defaults: { matiere: string; cycle: string },
): { confirmed: BoCompetenceDraft[]; toReview: BoCompetenceDraft[] } {
  const confirmed = result.competences.map((item) => mapFaithfulCompetenceToDraft(item, defaults));
  const toReview = (result.toReview ?? []).map(mapReviewItemToDraft);
  return { confirmed, toReview };
}
