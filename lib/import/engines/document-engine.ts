import "server-only";

import { randomUUID } from "node:crypto";
import type { UnifiedImportEngine } from "../unified-import-engine";
import { chunkUploader, computeBufferChecksum } from "@/lib/documents/import/ChunkUploader";
import { uploadManager } from "@/lib/documents/import/UploadManager";
import type { FloraDocument } from "@/lib/documents/types";

export type DocumentImportParsed = {
  documentId: string;
  title: string;
};

export type DocumentImportSession = {
  documentId: string;
  sessionId: string;
};

export const documentImportEngine: UnifiedImportEngine<
  DocumentImportParsed,
  DocumentImportSession,
  FloraDocument
> = {
  module: "document",
  async createBatch(config) {
    return config.batchId ?? randomUUID();
  },
  async uploadPage({ page, file }) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const init = await uploadManager.initUpload({
      filename: page.filename,
      fileSize: file.size,
      contentType: page.mimeType,
      checksum: computeBufferChecksum(buffer),
    });

    const chunkSize = init.chunkSize;
    const totalChunks = init.totalChunks;

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      await chunkUploader.storeChunk({
        sessionId: init.sessionId,
        chunkIndex: index,
        buffer: buffer.subarray(start, end),
        expectedTotalChunks: totalChunks,
      });
    }

    const completed = await uploadManager.completeUpload({
      sessionId: init.sessionId,
      checksum: computeBufferChecksum(buffer),
    });

    return {
      ...page,
      fileId: completed.documentId,
      storagePath: init.storagePath ?? page.storagePath,
    };
  },
  async analyze(input) {
    const documentId = input.pages[0]?.fileId;
    if (!documentId) {
      throw new Error("Document introuvable après téléversement.");
    }

    const { getDocumentDetails } = await import("@/lib/documents/document-service");
    const document = await getDocumentDetails(documentId);
    if (!document) throw new Error("Document introuvable.");

    return {
      parsed: { documentId, title: document.title },
      pages: input.pages,
      warnings: [],
    };
  },
  async buildSession({ parsed }) {
    return {
      documentId: parsed.documentId,
      sessionId: parsed.documentId,
    };
  },
  async save({ session }) {
    const { getDocumentDetails } = await import("@/lib/documents/document-service");
    const document = await getDocumentDetails(session.documentId);
    if (!document) throw new Error("Document introuvable.");
    return document;
  },
};
