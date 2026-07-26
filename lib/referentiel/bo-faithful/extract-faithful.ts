import type { BoCompetenceDraft, BoSectionId } from "../bo-types";
import { resolveProgrammeKind, sectionIdFromLabel, type BoProgrammeKind } from "../bo-section-splitter";
import type { BoFaithfulCompetence, BoFaithfulExtractionResult, BoFaithfulQualityReport } from "./types";
import { extractFaithfulBoCompetences, sliceProgrammeText } from "./extract-tables";
import { findIntroductionSplitIndex } from "./normalize";

function buildQualityReport(input: {
  introduction: string;
  structuredText: string;
  competences: BoFaithfulCompetence[];
  tables: BoFaithfulExtractionResult["quality"]["tables"];
}): BoFaithfulQualityReport {
  const competencesByMatiere: Record<string, number> = {};
  const competencesBySousMatiere: Record<string, number> = {};
  const competencesBySousSousMatiere: Record<string, number> = {};
  const competencesByNiveau: Record<string, number> = {};
  const warnings: string[] = [];

  for (const item of input.competences) {
    const matiere = item.hierarchy.matiere || "Non précisé";
    const sousMatiere = item.hierarchy.sousMatiere || "Non précisé";
    const sousSousMatiere = item.hierarchy.sousSousMatiere || "Non précisé";
    const niveau = item.hierarchy.niveau || "Non précisé";

    competencesByMatiere[matiere] = (competencesByMatiere[matiere] ?? 0) + 1;
    competencesBySousMatiere[sousMatiere] = (competencesBySousMatiere[sousMatiere] ?? 0) + 1;
    competencesBySousSousMatiere[sousSousMatiere] =
      (competencesBySousSousMatiere[sousSousMatiere] ?? 0) + 1;
    competencesByNiveau[niveau] = (competencesByNiveau[niveau] ?? 0) + 1;
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
    competencesByNiveau,
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
}): BoFaithfulExtractionResult {
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

  const { competences, tables } = extractFaithfulBoCompetences({
    text: scopedText,
    cycle: input.cycle,
    matiere: input.matiere,
    programme,
  });

  const quality = buildQualityReport({
    introduction,
    structuredText,
    competences,
    tables,
  });

  return {
    introduction,
    structuredText,
    competences,
    quality,
    extractionMethod: "faithful_v1",
  };
}

export function mapFaithfulCompetenceToDraft(
  item: BoFaithfulCompetence,
  defaults: { matiere: string; cycle: string },
): BoCompetenceDraft {
  const sectionLabel = item.hierarchy.sousMatiere || item.tableTitle || defaults.matiere;
  return {
    cycle: item.hierarchy.cycle || defaults.cycle,
    niveau: item.hierarchy.niveau,
    matiere: item.hierarchy.matiere || defaults.matiere,
    section: sectionLabel,
    sectionId: sectionIdFromLabel(sectionLabel) as BoSectionId,
    domaine: item.hierarchy.sousMatiere,
    sousDomaine: item.hierarchy.sousSousMatiere,
    competenceType: "competence",
    competence: item.competence,
    sousCompetence: "",
    sourceExcerpt: item.sourceExcerpt,
    code: "",
    tableTitle: item.tableTitle,
    columnName: item.columnName,
    tableFormat: item.tableFormat,
  };
}

export function mapFaithfulResultToDrafts(
  result: BoFaithfulExtractionResult,
  defaults: { matiere: string; cycle: string },
): BoCompetenceDraft[] {
  return result.competences.map((item) => mapFaithfulCompetenceToDraft(item, defaults));
}
