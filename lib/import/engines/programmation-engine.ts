import "server-only";

import { randomUUID } from "node:crypto";
import type {
  UnifiedImportAnalyzeResult,
  UnifiedImportEngine,
  UnifiedImportPage,
} from "../unified-import-engine";
import {
  analyzeProgrammingImportBatch,
  createProgrammingImportBatch,
  uploadProgrammingImportBatchFile,
} from "@/lib/programming/import/programmation-import-batch-service";
import {
  buildImportSession,
  saveImportedProgrammation,
} from "@/lib/programming/import/programmation-import-service";
import type {
  ParsedProgrammationImport,
  ProgrammationImportSession,
} from "@/lib/programming/import/types";
import { loadTeacherProfileForGeneration } from "@/lib/profile/profile-context";

export const programmationImportEngine: UnifiedImportEngine<
  ParsedProgrammationImport,
  ProgrammationImportSession,
  { programmationId: string }
> = {
  module: "programmation",
  async createBatch(config) {
    const { batchId } = await createProgrammingImportBatch({
      schoolYear: config.schoolYear,
      mergeMode: config.mergeMode,
      batchId: config.batchId,
    });
    return batchId;
  },
  async uploadPage({ batchId, page, file }) {
    const uploaded = await uploadProgrammingImportBatchFile({
      batchId,
      file,
      pageOrder: page.pageOrder,
      clientFileId: page.clientId,
    });
    const entry = uploaded.entries[0];
    return {
      ...page,
      fileId: entry.fileId,
      storagePath: entry.storagePath,
    };
  },
  async analyze(input) {
    const { parsed } = await analyzeProgrammingImportBatch(input.batchId);
    return {
      parsed,
      pages: input.pages,
      warnings: parsed.warnings ?? [],
    } satisfies UnifiedImportAnalyzeResult<ParsedProgrammationImport>;
  },
  async buildSession({ parsed, config }) {
    const bundle = await loadTeacherProfileForGeneration();
    return buildImportSession({
      parsed,
      schoolYear: config.schoolYear,
      academicZone: bundle.profile.zoneScolaire,
      levels: bundle.profile.levels,
      matiere: parsed.discipline,
    });
  },
  async save({ session }) {
    const saved = await saveImportedProgrammation({
      session,
      title: `Import programmation — ${session.parsed.discipline || session.matiere}`,
    });
    return { programmationId: saved.programmation.id };
  },
};
