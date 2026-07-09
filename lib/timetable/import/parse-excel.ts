import { readWorkbookGrid } from "./grid-reader";
import { mapSubjectLabel, applySubjectMapping, collectUncertainMappings } from "./subject-mapper";
import { buildParsedImport } from "./session-extractor";
import { detectStructure } from "./structure-detector";
import type { ParsedTimetableImport, StructureOverrides } from "./types";

export function parseTimetableFile(
  buffer: Buffer,
  fileName: string,
  subjectOverrides?: Record<string, string>,
  structureOverrides?: StructureOverrides,
): ParsedTimetableImport {
  const { sheetName, grid, merges } = readWorkbookGrid(buffer, fileName);
  const detection = detectStructure(grid, merges, structureOverrides);

  return buildParsedImport({
    fileName,
    sheetName,
    grid,
    merges,
    structure: detection.structure,
    needsManualStructure: detection.needsManualStructure,
    diagnostics: detection.diagnostics,
    subjectOverrides,
    structureOverrides,
  });
}

export function applyMappingOverrides(
  parsed: ParsedTimetableImport,
  overrides: Record<string, string>,
): ParsedTimetableImport {
  const sessions = parsed.sessions.map((session) => {
    const mapped = applySubjectMapping(session.rawLabel, overrides);
    return {
      ...session,
      subject: mapped.subject,
      slotType: mapped.slotType,
      color: mapped.color,
    };
  });

  return {
    ...parsed,
    sessions,
    uncertainMappings: collectUncertainMappings(sessions),
  };
}

export { mapSubjectLabel };
