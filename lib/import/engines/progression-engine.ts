import "server-only";

import { randomUUID } from "node:crypto";
import type { UnifiedImportEngine } from "../unified-import-engine";
import {
  analyzeProgressionImport,
  buildProgressionImportSession,
  saveImportedProgression,
} from "@/lib/progression/import/progression-import-service";
import type {
  ParsedProgressionImport,
  ProgressionImportSession,
} from "@/lib/progression/import/types";
import type { ProgressionPayload } from "@/lib/progression/types";

export const progressionImportEngine: UnifiedImportEngine<
  ParsedProgressionImport,
  ProgressionImportSession,
  ProgressionPayload
> = {
  module: "progression",
  async createBatch(config) {
    return config.batchId ?? randomUUID();
  },
  async uploadPage({ page }) {
    return page;
  },
  async analyze(input) {
    const first = input.pages[0];
    if (!first?.storagePath) {
      throw new Error("Aucun fichier téléversé pour l'analyse progression.");
    }

    const { storageService } = await import("@/lib/storage");
    const downloaded = await storageService.download(first.storagePath);
    const buffer = downloaded.body;

    const parsed = await analyzeProgressionImport({
      fileName: first.filename,
      buffer,
      mimeType: first.mimeType,
    });

    return { parsed, pages: input.pages, warnings: parsed.warnings ?? [] };
  },
  async buildSession({ parsed, config }) {
    return buildProgressionImportSession({
      parsed,
      schoolYear: config.schoolYear,
    });
  },
  async save({ session, config }) {
    return saveImportedProgression({
      session,
      schoolYear: config.schoolYear,
    });
  },
};
