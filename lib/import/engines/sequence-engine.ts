import "server-only";

import { randomUUID } from "node:crypto";
import type { UnifiedImportEngine } from "../unified-import-engine";
import {
  analyzeSequenceImport,
  buildSequenceImportSession,
  saveImportedSequences,
} from "@/lib/sequences/import/sequence-import-service";
import type {
  ParsedSequenceImport,
  SequenceImportSaveResult,
  SequenceImportSession,
} from "@/lib/sequences/import/types";

export const sequenceImportEngine: UnifiedImportEngine<
  ParsedSequenceImport,
  SequenceImportSession,
  SequenceImportSaveResult
> = {
  module: "sequence",
  async createBatch(config) {
    return config.batchId ?? randomUUID();
  },
  async uploadPage({ page }) {
    return page;
  },
  async analyze(input) {
    const first = input.pages[0];
    if (!first?.storagePath) {
      throw new Error("Aucun fichier téléversé pour l'analyse séquence.");
    }

    const { storageService } = await import("@/lib/storage");
    const downloaded = await storageService.download(first.storagePath);
    const parsed = await analyzeSequenceImport({
      fileName: first.filename,
      buffer: downloaded.body,
      mimeType: first.mimeType,
    });

    return { parsed, pages: input.pages, warnings: parsed.warnings ?? [] };
  },
  async buildSession({ parsed }) {
    return buildSequenceImportSession({ parsed });
  },
  async save({ session }) {
    return saveImportedSequences({ session });
  },
};
