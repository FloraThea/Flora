import type { TimetableImportSession } from "@/lib/timetable/import/types";

export type TimetableComparisonStatus =
  | "identique"
  | "horaire_incorrect"
  | "texte_modifie"
  | "matiere_remplacee"
  | "creneau_perdu"
  | "creneau_duplique";

export type TimetableSessionComparison = {
  daySource: string;
  celluleSource: string;
  startSource: string;
  endSource: string;
  rawLabelSource: string;
  startInterpreted: string;
  endInterpreted: string;
  rawLabelInterpreted: string;
  subjectInterpreted: string;
  rowIndex: number;
  colIndex: number;
  status: TimetableComparisonStatus;
  notes: string[];
};

function sessionKey(input: {
  day: string;
  startTime: string;
  endTime: string;
  rowIndex: number;
  colIndex: number;
}): string {
  return `${input.day}:${input.startTime}:${input.endTime}:${input.rowIndex}:${input.colIndex}`;
}

export function compareTimetableSessions(
  sourceSessions: Array<{
    day: string;
    startTime: string;
    endTime: string;
    rawLabel: string;
    rowIndex: number;
    colIndex: number;
  }>,
  parsedSessions: TimetableImportSession[],
): TimetableSessionComparison[] {
  const active = parsedSessions.filter((session) => !session.isEmpty);
  const comparisons: TimetableSessionComparison[] = [];
  const matchedParsedKeys = new Set<string>();

  for (const source of sourceSessions) {
    const parsed = active.find(
      (session) =>
        session.day === source.day &&
        session.rowIndex === source.rowIndex &&
        session.colIndex === source.colIndex,
    );

    const notes: string[] = [];
    let status: TimetableComparisonStatus = "identique";
    const celluleSource = `${source.rowIndex + 1}:${source.colIndex + 1}`;

    if (!parsed) {
      comparisons.push({
        daySource: source.day,
        celluleSource,
        startSource: source.startTime,
        endSource: source.endTime,
        rawLabelSource: source.rawLabel,
        startInterpreted: "",
        endInterpreted: "",
        rawLabelInterpreted: "",
        subjectInterpreted: "",
        rowIndex: source.rowIndex,
        colIndex: source.colIndex,
        status: "creneau_perdu",
        notes: ["Créneau source non importé"],
      });
      continue;
    }

    matchedParsedKeys.add(sessionKey(parsed));

    if (parsed.rawLabel.trim() !== source.rawLabel.trim()) {
      status = "texte_modifie";
      notes.push(`Texte cellule: source="${source.rawLabel}" importé="${parsed.rawLabel}"`);
    }

    if (parsed.startTime !== source.startTime || parsed.endTime !== source.endTime) {
      status = status === "identique" ? "horaire_incorrect" : status;
      notes.push(
        `Horaire: source=${source.startTime}-${source.endTime} importé=${parsed.startTime}-${parsed.endTime}`,
      );
    }

    const visibleSubject = parsed.rawLabel.trim() || parsed.subject.trim();
    if (parsed.subject.trim() !== visibleSubject) {
      status = status === "identique" ? "matiere_remplacee" : status;
      notes.push(`Matière visible remplacée: "${parsed.subject}" au lieu de "${visibleSubject}"`);
    }

    comparisons.push({
      daySource: source.day,
      celluleSource,
      startSource: source.startTime,
      endSource: source.endTime,
      rawLabelSource: source.rawLabel,
      startInterpreted: parsed.startTime,
      endInterpreted: parsed.endTime,
      rawLabelInterpreted: parsed.rawLabel,
      subjectInterpreted: parsed.subject,
      rowIndex: source.rowIndex,
      colIndex: source.colIndex,
      status,
      notes,
    });
  }

  for (const parsed of active) {
    const key = sessionKey(parsed);
    if (matchedParsedKeys.has(key)) continue;
    comparisons.push({
      daySource: parsed.day,
      celluleSource: `${parsed.rowIndex + 1}:${parsed.colIndex + 1}`,
      startSource: "",
      endSource: "",
      rawLabelSource: "",
      startInterpreted: parsed.startTime,
      endInterpreted: parsed.endTime,
      rawLabelInterpreted: parsed.rawLabel,
      subjectInterpreted: parsed.subject,
      rowIndex: parsed.rowIndex,
      colIndex: parsed.colIndex,
      status: "creneau_duplique",
      notes: ["Créneau importé sans équivalent source"],
    });
  }

  return comparisons.sort((a, b) => {
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
    if (a.colIndex !== b.colIndex) return a.colIndex - b.colIndex;
    return a.daySource.localeCompare(b.daySource);
  });
}
