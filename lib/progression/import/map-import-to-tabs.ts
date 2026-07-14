import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import type { ProgrammationPayload } from "@/lib/programming/types";
import type { FloraAccent } from "@/lib/theme";
import type { ProgressionRow, ProgressionTab } from "../types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesDiscipline(
  row: ImportedProgrammationRow,
  subjectLabel: string,
  subSubjectLabel: string,
): boolean {
  const discipline = normalize(row.discipline || row.domaine);
  if (!discipline) return false;

  const subject = normalize(subjectLabel);
  const subSubject = normalize(subSubjectLabel);

  return (
    (subject.length > 0 &&
      (subject.includes(discipline) || discipline.includes(subject))) ||
    (subSubject.length > 0 &&
      (subSubject.includes(discipline) || discipline.includes(subSubject)))
  );
}

function mapRowToDraft(
  row: ImportedProgrammationRow,
  index: number,
  sessionNumber: number,
): Omit<ProgressionRow, "id" | "sortOrder"> {
  const periodNumber = row.periodNumber ?? 1;
  const weekNumber = row.weekNumber ?? Math.floor(index / 3) + 1;
  const objectifs = [
    ...(row.objectif ? [row.objectif] : []),
    ...row.notions.filter(Boolean),
  ];

  return {
    periodNumber,
    weekNumber,
    sessionNumber,
    sequenceModule: row.sequence || row.domaine,
    seanceLabel: row.seance || `Séance ${sessionNumber}`,
    competenceBo: row.competences[0] ?? "",
    objectifs,
    deroulement: row.deroulement,
    materiel: row.materiel,
    resources: row.ressources,
    remarques: row.remarques,
    commentaires: [row.evaluation, row.differenciation].filter(Boolean).join(" — "),
    referentielIds: [],
    resourceIds: [],
    metadata: { importedRowId: row.id },
  };
}

function buildTabFromRows(
  subjectKey: string,
  subjectLabel: string,
  subSubjectLabel: string,
  accent: FloraAccent,
  sortOrder: number,
  rows: ImportedProgrammationRow[],
  programmingTableId?: string,
): ProgressionTab {
  let lastWeekKey = "";
  let sessionInWeek = 0;

  const mappedRows: ProgressionRow[] = rows.map((row, index) => {
    const periodNumber = row.periodNumber ?? 1;
    const weekNumber = row.weekNumber ?? Math.floor(index / 3) + 1;
    const weekKey = `${periodNumber}-${weekNumber}`;

    if (weekKey !== lastWeekKey) {
      sessionInWeek = 1;
      lastWeekKey = weekKey;
    } else {
      sessionInWeek += 1;
    }

    return {
      ...mapRowToDraft(row, index, sessionInWeek),
      id: `draft-${subjectKey}-${index}`,
      sortOrder: index,
    };
  });

  return {
    programmingTableId,
    subjectKey,
    subjectLabel,
    subSubjectLabel,
    accent,
    sortOrder,
    rows: mappedRows,
  };
}

export function mapImportedRowsToTabs(
  rows: ImportedProgrammationRow[],
  programmation: ProgrammationPayload,
): ProgressionTab[] {
  const tables = programmation.tables;

  if (tables.length === 0) {
    return [buildTabFromRows("import", "Progression importée", "", "lavender", 0, rows)];
  }

  if (tables.length === 1) {
    const table = tables[0];
    return [
      buildTabFromRows(
        table.subjectKey,
        table.subjectLabel,
        table.subSubjectLabel,
        table.accent,
        table.sortOrder,
        rows,
        table.id,
      ),
    ];
  }

  const grouped = new Map<string, ImportedProgrammationRow[]>();
  const unassigned: ImportedProgrammationRow[] = [];

  for (const row of rows) {
    const matchedTable = tables.find((table) =>
      matchesDiscipline(row, table.subjectLabel, table.subSubjectLabel),
    );

    if (matchedTable) {
      const bucket = grouped.get(matchedTable.subjectKey) ?? [];
      bucket.push(row);
      grouped.set(matchedTable.subjectKey, bucket);
    } else {
      unassigned.push(row);
    }
  }

  if (unassigned.length > 0) {
    const firstKey = tables[0].subjectKey;
    grouped.set(firstKey, [...(grouped.get(firstKey) ?? []), ...unassigned]);
  }

  const tabs = tables
    .map((table) => {
      const tableRows = grouped.get(table.subjectKey) ?? [];
      if (tableRows.length === 0) return null;

      return buildTabFromRows(
        table.subjectKey,
        table.subjectLabel,
        table.subSubjectLabel,
        table.accent,
        table.sortOrder,
        tableRows,
        table.id,
      );
    })
    .filter((tab): tab is ProgressionTab => tab !== null);

  if (tabs.length === 0) {
    const table = tables[0];
    return [
      buildTabFromRows(
        table.subjectKey,
        table.subjectLabel,
        table.subSubjectLabel,
        table.accent,
        table.sortOrder,
        rows,
        table.id,
      ),
    ];
  }

  return tabs;
}
