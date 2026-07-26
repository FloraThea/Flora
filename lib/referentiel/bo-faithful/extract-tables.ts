import type { BoProgrammeKind } from "../bo-section-splitter";
import type { BoFaithfulCompetence, BoFaithfulHierarchy, BoFaithfulTableReport, BoTableFormat } from "./types";
import {
  detectEvarNiveauFromContext,
  detectNiveauFromLine,
  isCompetenceCandidateBullet,
  isConnaissancesTableHeader,
  isDomainHeading,
  isEmcAttendusHeader,
  isEmcCompetenceProseLine,
  isEmcConnaissancesHeader,
  isEmcConnaissancesHeaderContinuation,
  isEmcDomainHeading,
  isEmcObjetEnseignementLine,
  isEvarDomainHeading,
  isEvarObjectifLine,
  isExampleParagraph,
  isNotionsCompetencesHeader,
  isObjectifsTableHeader,
  isPeriodMarker,
  isSubdomainHeading,
  mergeMultilineBullet,
  normalizeBoKey,
  normalizeBoLine,
} from "./normalize";

type HierarchyState = BoFaithfulHierarchy & {
  tableTitle: string;
};

type ActiveTable = {
  tableTitle: string;
  tableFormat: BoTableFormat;
  columnName: string;
  competencesExtracted: number;
  warnings: string[];
};

function createHierarchy(defaults: { cycle: string; matiere: string }): HierarchyState {
  return {
    cycle: defaults.cycle,
    niveau: "",
    matiere: defaults.matiere,
    sousMatiere: "",
    sousSousMatiere: "",
    tableTitle: "",
  };
}

function cloneHierarchy(state: HierarchyState): BoFaithfulHierarchy {
  return {
    cycle: state.cycle,
    niveau: state.niveau,
    matiere: state.matiere,
    sousMatiere: state.sousMatiere,
    sousSousMatiere: state.sousSousMatiere,
  };
}

function startTable(
  state: HierarchyState,
  format: BoTableFormat,
  columnName: string,
  currentTable: ActiveTable | null,
  tables: BoFaithfulTableReport[],
): ActiveTable {
  if (currentTable) {
    tables.push({
      tableTitle: currentTable.tableTitle,
      tableFormat: currentTable.tableFormat,
      columnName: currentTable.columnName,
      competencesExtracted: currentTable.competencesExtracted,
      warnings: currentTable.warnings,
    });
  }

  return {
    tableTitle: state.tableTitle || state.sousSousMatiere || state.sousMatiere || "Programme",
    tableFormat: format,
    columnName,
    competencesExtracted: 0,
    warnings: [],
  };
}

function mergeEmcProseLines(lines: string[], startIndex: number): { text: string; endIndex: number } {
  let text = normalizeBoLine(lines[startIndex] ?? "");
  let index = startIndex + 1;

  while (index < lines.length) {
    const next = normalizeBoLine(lines[index] ?? "");
    if (!next) break;
    if (isEmcCompetenceProseLine(next) && /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(next) && text.endsWith(".")) break;
    if (isEmcDomainHeading(next) || isEmcConnaissancesHeader(next) || isEmcAttendusHeader(next)) break;
    if (isEmcObjetEnseignementLine(next)) break;
    if (isCompetenceCandidateBullet(next)) break;
    if (next.length > 120) break;

    text = `${text} ${next}`.replace(/\s+/g, " ").trim();
    index += 1;
  }

  return { text, endIndex: index - 1 };
}

export function sliceProgrammeText(text: string, programme: BoProgrammeKind, cycle?: string): string {
  if (programme !== "emc_moral") return text;

  const normalizedCycle = normalizeBoKey(cycle ?? "");
  if (normalizedCycle.includes("cycle 2")) {
    const cycle2Block = text.match(
      /Cycle 2\s*\n\s*[•·\u2022]?\s*Respecter autrui[\s\S]*?(?=Cycle 3\b|Langues vivantes\b|Éducation physique et sportive\b|$)/i,
    );
    if (cycle2Block?.[0]) return cycle2Block[0].trim();
  }

  const heading = /Enseignement moral et civique/gi;
  let bestStart = -1;
  let match: RegExpExecArray | null;
  while ((match = heading.exec(text)) !== null) {
    const window = text.slice(match.index, match.index + 1500);
    if (/Les finalit[eé]s|Respecter autrui|Attendus de fin de cycle/i.test(window)) {
      bestStart = match.index;
    }
  }

  if (bestStart >= 0) {
    const slice = text.slice(bestStart);
    const end = slice.search(/\n(Cycle 3\b|Langues vivantes\b|Éducation physique et sportive\b)/i);
    return (end >= 0 ? slice.slice(0, end) : slice).trim();
  }

  return text;
}

function extractFromTableStream(input: {
  lines: string[];
  cycle: string;
  matiere: string;
  programme?: BoProgrammeKind;
  sortKeyStart?: number;
}): { competences: BoFaithfulCompetence[]; tables: BoFaithfulTableReport[]; sortKeyEnd: number } {
  if (input.programme === "evar") {
    return extractEvarTables(input);
  }
  if (input.programme === "emc_moral") {
    return extractEmcTables(input);
  }

  const state = createHierarchy({ cycle: input.cycle, matiere: input.matiere });
  const competences: BoFaithfulCompetence[] = [];
  const tables: BoFaithfulTableReport[] = [];
  let sortKey = input.sortKeyStart ?? 0;
  let inCompetenceColumn = false;
  let currentTable: ActiveTable | null = null;
  let activeColumnName = "Objectifs d'apprentissage";

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = normalizeBoLine(input.lines[index] ?? "");
    if (!line) continue;

    const niveau = detectNiveauFromLine(line);
    if (niveau) {
      state.niveau = niveau;
      continue;
    }

    if (isDomainHeading(line)) {
      state.sousMatiere = line;
      state.sousSousMatiere = "";
      state.tableTitle = line;
      continue;
    }

    if (isSubdomainHeading(line, input.matiere) && !isObjectifsTableHeader(line) && !isConnaissancesTableHeader(line)) {
      state.sousSousMatiere = line;
      state.tableTitle = line;
      continue;
    }

    if (isObjectifsTableHeader(line)) {
      currentTable = startTable(state, "objectifs_exemples", "Objectifs d'apprentissage", currentTable, tables);
      activeColumnName = "Objectifs d'apprentissage";
      inCompetenceColumn = true;
      continue;
    }

    if (isConnaissancesTableHeader(line)) {
      currentTable = startTable(
        state,
        "connaissances_associees",
        "Connaissances et compétences associées",
        currentTable,
        tables,
      );
      activeColumnName = "Connaissances et compétences associées";
      inCompetenceColumn = true;
      continue;
    }

    if (!inCompetenceColumn) {
      if (!state.tableTitle && line.length <= 100 && !line.startsWith("-")) {
        state.tableTitle = line;
      }
      continue;
    }

    if (isPeriodMarker(line)) continue;

    if (!isCompetenceCandidateBullet(line)) {
      if (isExampleParagraph(line)) continue;
      continue;
    }

    const merged = mergeMultilineBullet(input.lines, index);
    index = merged.endIndex;

    const competence = merged.text.trim();
    if (competence.length < 8 || isExampleParagraph(competence)) continue;

    sortKey += 1;
    competences.push({
      competence,
      hierarchy: cloneHierarchy(state),
      tableTitle: currentTable?.tableTitle ?? state.tableTitle,
      columnName: activeColumnName,
      tableFormat: currentTable?.tableFormat ?? "objectifs_exemples",
      sourceExcerpt: competence,
      sortKey,
    });

    if (currentTable) currentTable.competencesExtracted += 1;
  }

  if (currentTable) {
    tables.push({
      tableTitle: currentTable.tableTitle,
      tableFormat: currentTable.tableFormat,
      columnName: currentTable.columnName,
      competencesExtracted: currentTable.competencesExtracted,
      warnings: currentTable.warnings,
    });
  }

  return { competences, tables, sortKeyEnd: sortKey };
}

function extractEvarTables(input: {
  lines: string[];
  cycle: string;
  matiere: string;
  sortKeyStart?: number;
}): { competences: BoFaithfulCompetence[]; tables: BoFaithfulTableReport[]; sortKeyEnd: number } {
  const state = createHierarchy({ cycle: input.cycle, matiere: input.matiere });
  const competences: BoFaithfulCompetence[] = [];
  const tables: BoFaithfulTableReport[] = [];
  let sortKey = input.sortKeyStart ?? 0;
  let inCompetenceColumn = false;
  let currentTable: ActiveTable | null = null;
  const activeColumnName = "Notions et compétences";

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = normalizeBoLine(input.lines[index] ?? "");
    if (!line) continue;

    const niveau = detectEvarNiveauFromContext(line);
    if (niveau && niveau !== "Cycle 2" && niveau !== "Cycle 3") {
      state.niveau = niveau;
      continue;
    }

    if (isEvarDomainHeading(line)) {
      state.sousMatiere = line;
      state.sousSousMatiere = "";
      state.tableTitle = line;
      continue;
    }

    if (isEvarObjectifLine(line)) {
      const objectifLabel = line.split(/:/).slice(1).join(":").trim();
      if (objectifLabel) {
        state.sousSousMatiere = objectifLabel;
        state.tableTitle = objectifLabel;
      }
      continue;
    }

    if (isNotionsCompetencesHeader(line)) {
      currentTable = startTable(state, "connaissances_associees", activeColumnName, currentTable, tables);
      inCompetenceColumn = true;
      continue;
    }

    if (!inCompetenceColumn) continue;

    if (isPeriodMarker(line) || isEvarObjectifLine(line) || isEvarDomainHeading(line)) continue;

    if (!isCompetenceCandidateBullet(line)) {
      if (isExampleParagraph(line)) continue;
      if (/^propositions de demarches/i.test(normalizeBoLine(line))) {
        inCompetenceColumn = false;
      }
      continue;
    }

    const merged = mergeMultilineBullet(input.lines, index);
    index = merged.endIndex;
    const competence = merged.text.trim();
    if (competence.length < 12 || isExampleParagraph(competence)) continue;

    sortKey += 1;
    competences.push({
      competence,
      hierarchy: cloneHierarchy(state),
      tableTitle: currentTable?.tableTitle ?? state.tableTitle,
      columnName: activeColumnName,
      tableFormat: "connaissances_associees",
      sourceExcerpt: competence,
      sortKey,
    });

    if (currentTable) currentTable.competencesExtracted += 1;
  }

  if (currentTable) {
    tables.push({
      tableTitle: currentTable.tableTitle,
      tableFormat: currentTable.tableFormat,
      columnName: currentTable.columnName,
      competencesExtracted: currentTable.competencesExtracted,
      warnings: currentTable.warnings,
    });
  }

  return { competences, tables, sortKeyEnd: sortKey };
}

function extractEmcTables(input: {
  lines: string[];
  cycle: string;
  matiere: string;
  sortKeyStart?: number;
}): { competences: BoFaithfulCompetence[]; tables: BoFaithfulTableReport[]; sortKeyEnd: number } {
  const state = createHierarchy({ cycle: input.cycle, matiere: input.matiere });
  if (input.cycle.includes("Cycle 2")) {
    state.niveau = "Cycle 2";
  }
  const competences: BoFaithfulCompetence[] = [];
  const tables: BoFaithfulTableReport[] = [];
  let sortKey = input.sortKeyStart ?? 0;
  let inCompetenceColumn = false;
  let inAttendusSection = false;
  let currentTable: ActiveTable | null = null;
  const activeColumnName = "Connaissances et compétences associées";

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = normalizeBoLine(input.lines[index] ?? "");
    if (!line) continue;

    const niveau = detectEvarNiveauFromContext(line);
    if (niveau === "CP" || niveau === "CE1" || niveau === "CE2" || niveau === "CM1" || niveau === "CM2") {
      state.niveau = niveau;
      continue;
    }

    if (/^cycle 2$/i.test(line)) {
      state.cycle = "Cycle 2";
      continue;
    }

    if (isEmcDomainHeading(line)) {
      state.sousMatiere = line.replace(/^[•·-]\s*/, "");
      state.sousSousMatiere = "";
      state.tableTitle = state.sousMatiere;
      inAttendusSection = false;
      continue;
    }

    if (isEmcAttendusHeader(line)) {
      inAttendusSection = true;
      inCompetenceColumn = false;
      continue;
    }

    if (isEmcConnaissancesHeader(line) || isEmcConnaissancesHeaderContinuation(line, input.lines[index - 1] ?? "")) {
      currentTable = startTable(state, "connaissances_associees", activeColumnName, currentTable, tables);
      inCompetenceColumn = true;
      inAttendusSection = false;
      continue;
    }

    if (inAttendusSection && isCompetenceCandidateBullet(line)) {
      const merged = mergeMultilineBullet(input.lines, index);
      index = merged.endIndex;
      const competence = merged.text.trim();
      if (competence.length >= 12) {
        sortKey += 1;
        competences.push({
          competence,
          hierarchy: cloneHierarchy(state),
          tableTitle: "Attendus de fin de cycle",
          columnName: "Attendus de fin de cycle",
          tableFormat: "connaissances_associees",
          sourceExcerpt: competence,
          sortKey,
        });
      }
      continue;
    }

    if (!inCompetenceColumn) continue;

    if (isEmcObjetEnseignementLine(line)) continue;

    if (isEmcDomainHeading(line) && line.startsWith("Le ")) {
      state.sousSousMatiere = line;
      continue;
    }

    if (isCompetenceCandidateBullet(line)) {
      const merged = mergeMultilineBullet(input.lines, index);
      index = merged.endIndex;
      const competence = merged.text.trim();
      if (competence.length < 12) continue;

      sortKey += 1;
      competences.push({
        competence,
        hierarchy: cloneHierarchy(state),
        tableTitle: currentTable?.tableTitle ?? state.tableTitle,
        columnName: activeColumnName,
        sourceExcerpt: competence,
        tableFormat: "connaissances_associees",
        sortKey,
      });
      if (currentTable) currentTable.competencesExtracted += 1;
      continue;
    }

    if (isEmcCompetenceProseLine(line)) {
      const merged = mergeEmcProseLines(input.lines, index);
      index = merged.endIndex;
      const competence = merged.text.trim();
      if (competence.length < 12 || isEmcObjetEnseignementLine(competence)) continue;

      sortKey += 1;
      competences.push({
        competence,
        hierarchy: cloneHierarchy(state),
        tableTitle: currentTable?.tableTitle ?? state.tableTitle,
        columnName: activeColumnName,
        tableFormat: "connaissances_associees",
        sourceExcerpt: competence,
        sortKey,
      });
      if (currentTable) currentTable.competencesExtracted += 1;
    }
  }

  if (currentTable) {
    tables.push({
      tableTitle: currentTable.tableTitle,
      tableFormat: currentTable.tableFormat,
      columnName: currentTable.columnName,
      competencesExtracted: currentTable.competencesExtracted,
      warnings: currentTable.warnings,
    });
  }

  return { competences, tables, sortKeyEnd: sortKey };
}

export function extractFaithfulBoCompetences(input: {
  text: string;
  cycle: string;
  matiere: string;
  programme?: BoProgrammeKind;
}): {
  competences: BoFaithfulCompetence[];
  tables: BoFaithfulTableReport[];
} {
  const programme = input.programme ?? "francais";
  const scopedText = sliceProgrammeText(input.text, programme, input.cycle);
  const lines = scopedText.split(/\r?\n/);
  const result = extractFromTableStream({
    lines,
    cycle: input.cycle,
    matiere: input.matiere,
    programme,
  });

  return {
    competences: result.competences,
    tables: result.tables,
  };
}
