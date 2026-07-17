import "server-only";

import { randomUUID } from "node:crypto";
import type { UnifiedImportEngine } from "../unified-import-engine";
import {
  analyzeTimetableFile,
  saveImportedTimetable,
} from "@/lib/timetable/import/timetable-import-service";
import type {
  ParsedTimetableImport,
  TimetableImportSaveResult,
} from "@/lib/timetable/import/types";

export type TimetableImportEngineSession = {
  parsed: ParsedTimetableImport;
  mappingOverrides?: Record<string, string>;
};

export const timetableImportEngine: UnifiedImportEngine<
  ParsedTimetableImport,
  TimetableImportEngineSession,
  TimetableImportSaveResult
> = {
  module: "timetable",
  async createBatch(config) {
    return config.batchId ?? randomUUID();
  },
  async uploadPage({ page }) {
    return page;
  },
  async analyze(input) {
    const first = input.pages[0];
    if (!first?.storagePath) {
      throw new Error("Aucun fichier téléversé pour l'analyse emploi du temps.");
    }

    const { storageService } = await import("@/lib/storage");
    const downloaded = await storageService.download(first.storagePath);
    const buffer = downloaded.body;

    const parsed = await analyzeTimetableFile(buffer, first.filename);
    return { parsed, pages: input.pages, warnings: parsed.warnings ?? [] };
  },
  async buildSession({ parsed }) {
    return { parsed };
  },
  async save({ session, config }) {
    return saveImportedTimetable({
      scheduleName: `Import EDT — ${session.parsed.className || config.schoolYear}`,
      schoolYear: config.schoolYear,
      className: session.parsed.className,
      teacherName: session.parsed.teacherName,
      sessions: session.parsed.sessions,
      isPrimary: true,
      sourceFileName: session.parsed.fileName,
      confirmedMappings: session.mappingOverrides,
    });
  },
};
