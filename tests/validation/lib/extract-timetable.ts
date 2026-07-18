import fs from "node:fs";
import { parseTimetableFile } from "@/lib/timetable/import/parse-excel";
import { duplicateSlot } from "@/lib/timetable/slot-editor/operations";
import { importSessionToSlot } from "@/lib/timetable/import/types";
import { buildExportCardContentLines } from "@/lib/timetable/slot-display";
import { computeSlotCardTypography } from "@/lib/timetable/slot-card-typography";
import { normalizeTimetableSession, type TimetableValidationSnapshot } from "./snapshot-types";

export async function extractTimetableSnapshot(
  buffer: Buffer,
  fileName: string,
): Promise<TimetableValidationSnapshot> {
  const parsed = await parseTimetableFile(buffer, fileName);
  const sessions = parsed.sessions.filter((session) => !session.isEmpty);

  const exportLines = sessions.slice(0, 20).flatMap((session) => {
    const slot = importSessionToSlot(session, "validation-schedule");
    const display = buildExportCardContentLines({
      subject: slot.subject,
      subSubject: slot.subSubject,
      complementaryText: slot.customText,
    });
    return display.map((line) => line.text);
  });

  const withComplementary = sessions.filter(
    (session) => (session.customText ?? session.notes ?? "").trim().length > 0,
  ).length;

  let duplicatePreservesComplementary = true;
  for (const session of sessions.slice(0, 5)) {
    const slot = importSessionToSlot(session, "validation-schedule");
    if (!slot.customText?.trim()) continue;
    const copy = duplicateSlot(slot, "validation-schedule-2");
    if (copy.customText !== slot.customText) {
      duplicatePreservesComplementary = false;
      break;
    }
  }

  const typography = computeSlotCardTypography(36);
  const complementaryVisible = typography.showComplementaryText === true;

  return {
    kind: "emploi_du_temps",
    fileName,
    sheetName: parsed.sheetName,
    className: parsed.className,
    schoolYear: parsed.schoolYear,
    days: parsed.days,
    stats: {
      sessionCount: sessions.length,
      withComplementaryText: withComplementary,
      withSubSubject: sessions.filter((s) => (s.subSubject ?? s.title ?? "").trim()).length,
      uniqueSubjects: new Set(sessions.map((s) => s.subject).filter(Boolean)).size,
      mergedCellCount: parsed.diagnostics.mergedCellCount,
    },
    sessions: sessions.map(normalizeTimetableSession),
    exportLines,
    displayChecks: {
      complementaryVisible,
      duplicatePreservesComplementary,
    },
    warnings: parsed.warnings,
    needsManualStructure: parsed.needsManualStructure,
  };
}

export async function loadTimetableSnapshot(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  return extractTimetableSnapshot(buffer, filePath.split("/").pop() ?? filePath);
}
