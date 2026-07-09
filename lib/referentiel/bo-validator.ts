import type { BoCompetenceDraft, BoSectionChunk, BoValidationReport } from "./bo-types";
import { BO_FRANCAIS_SECTIONS } from "./bo-types";

const MIN_COMPETENCES_PER_MAJOR_SECTION = 3;

export function validateBoExtraction(input: {
  competences: BoCompetenceDraft[];
  sections: BoSectionChunk[];
  matiere: string;
}): BoValidationReport {
  const competencesBySection: Record<string, number> = {};
  const competencesByType: Record<string, number> = {};
  const warnings: string[] = [];
  const probableMissing: string[] = [];

  for (const item of input.competences) {
    competencesBySection[item.section] = (competencesBySection[item.section] ?? 0) + 1;
    competencesByType[item.competenceType] =
      (competencesByType[item.competenceType] ?? 0) + 1;
  }

  const sectionsDetected = Object.keys(competencesBySection);
  const expectedSections = BO_FRANCAIS_SECTIONS.filter((section) => section.id !== "francais")
    .map((section) => section.label);

  const sectionsMissing = expectedSections.filter(
    (label) => !sectionsDetected.some((detected) => detected.includes(label.split(" ")[0])),
  );

  for (const section of input.sections) {
    const count = competencesBySection[section.label] ?? 0;
    if (count === 0) {
      warnings.push(`Aucune compétence détectée pour la section « ${section.label} ».`);
      probableMissing.push(section.label);
    } else if (
      section.id !== "francais" &&
      count < MIN_COMPETENCES_PER_MAJOR_SECTION
    ) {
      warnings.push(
        `Section « ${section.label} » : seulement ${count} élément(s) détecté(s), extraction probablement incomplète.`,
      );
      probableMissing.push(section.label);
    }
  }

  if ((competencesByType.attendu ?? 0) === 0) {
    warnings.push("Aucun attendu de fin de cycle explicitement détecté.");
  }

  if (input.competences.length < 20 && input.matiere === "Français") {
    warnings.push(
      "Nombre total de compétences faible pour un BO de français : vérifiez l'exhaustivité de l'extraction.",
    );
  }

  return {
    totalCompetences: input.competences.length,
    sectionsDetected,
    sectionsMissing,
    competencesBySection,
    competencesByType,
    warnings,
    probableMissing,
  };
}
