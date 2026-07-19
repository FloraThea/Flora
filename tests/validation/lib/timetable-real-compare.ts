import type { TimetableImportSession } from "@/lib/timetable/import/types";

export type TimetableComparisonStatus =
  | "identique"
  | "transformée_correctement"
  | "incorrecte"
  | "perdue";

export type TimetableSessionComparison = {
  daySource: string;
  dayInterpreted: string;
  startSource: string;
  startInterpreted: string;
  endSource: string;
  endInterpreted: string;
  rawLabelSource: string;
  rawLabelInterpreted: string;
  subjectSource: string;
  subjectInterpreted: string;
  rowIndex: number;
  colIndex: number;
  status: TimetableComparisonStatus;
  notes: string[];
};

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

  for (const source of sourceSessions) {
    const parsed = active.find(
      (session) =>
        session.day === source.day &&
        session.startTime === source.startTime &&
        session.endTime === source.endTime &&
        session.rowIndex === source.rowIndex &&
        session.colIndex === source.colIndex,
    );

    const notes: string[] = [];
    let status: TimetableComparisonStatus = "identique";

    if (!parsed) {
      comparisons.push({
        daySource: source.day,
        dayInterpreted: "",
        startSource: source.startTime,
        startInterpreted: "",
        endSource: source.endTime,
        endInterpreted: "",
        rawLabelSource: source.rawLabel,
        rawLabelInterpreted: "",
        subjectSource: source.rawLabel.split(/[:–-]/)[0]?.trim() ?? source.rawLabel,
        subjectInterpreted: "",
        rowIndex: source.rowIndex,
        colIndex: source.colIndex,
        status: "perdue",
        notes: ["Créneau source non importé"],
      });
      continue;
    }

    if (parsed.rawLabel.trim() !== source.rawLabel.trim()) {
      status = "incorrecte";
      notes.push(`Texte cellule: source="${source.rawLabel}" interprété="${parsed.rawLabel}"`);
    }
    if (parsed.day !== source.day) {
      status = "incorrecte";
      notes.push(`Jour: source=${source.day} interprété=${parsed.day}`);
    }
    if (parsed.startTime !== source.startTime || parsed.endTime !== source.endTime) {
      status = "incorrecte";
      notes.push(
        `Horaire: source=${source.startTime}-${source.endTime} interprété=${parsed.startTime}-${parsed.endTime}`,
      );
    }
    if (!parsed.subject.trim()) {
      status = "incorrecte";
      notes.push("Matière non détectée");
    } else if (parsed.subject !== source.rawLabel.trim() && !source.rawLabel.toLowerCase().includes(parsed.subject.toLowerCase())) {
      status = status === "identique" ? "transformée_correctement" : status;
      notes.push(`Matière mappée: ${parsed.subject}`);
    }

    comparisons.push({
      daySource: source.day,
      dayInterpreted: parsed.day,
      startSource: source.startTime,
      startInterpreted: parsed.startTime,
      endSource: source.endTime,
      endInterpreted: parsed.endTime,
      rawLabelSource: source.rawLabel,
      rawLabelInterpreted: parsed.rawLabel,
      subjectSource: source.rawLabel.split(/[:–-]/)[0]?.trim() ?? source.rawLabel,
      subjectInterpreted: parsed.subject,
      rowIndex: source.rowIndex,
      colIndex: source.colIndex,
      status,
      notes,
    });
  }

  return comparisons;
}
