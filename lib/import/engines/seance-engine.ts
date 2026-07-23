import "server-only";

import { randomUUID } from "node:crypto";
import type { UnifiedImportEngine } from "../unified-import-engine";
import {
  analyzeSeanceImport,
  buildSeanceImportSession,
  saveImportedSeances,
} from "@/lib/seances/import/seance-import-service";
import type {
  ParsedSeanceImport,
  SeanceImportSaveResult,
  SeanceImportSession,
} from "@/lib/seances/import/types";

export const seanceImportEngine: UnifiedImportEngine<
  ParsedSeanceImport,
  SeanceImportSession,
  SeanceImportSaveResult
> = {
  module: "seance",
  async createBatch(config) {
    return config.batchId ?? randomUUID();
  },
  async uploadPage({ page }) {
    return page;
  },
  async analyze(input) {
    const first = input.pages[0];
    if (!first?.storagePath) {
      throw new Error("Aucun fichier téléversé pour l'analyse séance.");
    }

    const { storageService } = await import("@/lib/storage");
    const downloaded = await storageService.download(first.storagePath);
    const parsed = await analyzeSeanceImport({
      fileName: first.filename,
      buffer: downloaded.body,
      mimeType: first.mimeType,
    });

    return { parsed, pages: input.pages, warnings: parsed.warnings ?? [] };
  },
  async buildSession({ parsed }) {
    return buildSeanceImportSession({ parsed });
  },
  async save({ session }) {
    return saveImportedSeances({ session });
  },
};
