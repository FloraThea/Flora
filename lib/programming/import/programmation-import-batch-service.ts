import "server-only";

import { randomUUID } from "node:crypto";
import { resolveFileExtension, resolveImportFileName } from "@/lib/import/accepted-formats";
import { isValidImportUuid } from "@/lib/import/import-api-errors";
import { devLog } from "@/lib/logger";
import { getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import { storageService } from "@/lib/storage";
import { getStorageProviderName, tryGetR2Config } from "@/lib/storage/config";
import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  buildProgrammationBatchStoragePath,
} from "@/lib/supabase/storage-config";
import {
  PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES,
} from "./batch-limits";
import type {
  ImportBatchMergeMode,
  ImportBatchStatus,
  ImportedFileStatus,
  ProgrammingImportUploadedFileDescriptor,
} from "./batch-types";
import { validateBatchFiles } from "./batch-validation";
import { extractPdfPageTexts } from "./extract-pdf-pages";
import { mergeProgrammationPages, type PageParseResult } from "./merge-programmation-pages";
import { parseProgrammationFile } from "./parse-programmation";
import {
  mapProgrammingImportErrorMessage,
  ProgrammingImportError,
} from "./programming-import-errors";
import { validateProgrammingAnalysisResponse } from "./programming-analysis-schema";
import type { ParsedProgrammationImport } from "./types";

type BatchRow = {
  id: string;
  teacher_profile_id: string;
  school_year: string;
  status: ImportBatchStatus;
  merge_mode: ImportBatchMergeMode;
  parsed_snapshot: ParsedProgrammationImport | null;
};

type FileRow = {
  id: string;
  batch_id: string;
  page_order: number;
  filename: string;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
  analysis_status: ImportedFileStatus;
  analysis_error: string;
  parsed_snapshot: ParsedProgrammationImport | null;
  pdf_page_number: number | null;
  source_file_id: string | null;
};

function isMissingProgrammingImportTable(error: unknown): boolean {
  const message = getSupabaseErrorMessage(error, "").toLowerCase();
  return (
    message.includes("programming_import") ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("pgrst205") ||
    message.includes("42p01")
  );
}

function canUseDirectUpload(): boolean {
  return getStorageProviderName() === "cloudflare_r2" && Boolean(tryGetR2Config());
}

async function resolveProfileBundle() {
  try {
    return await getOrCreateTeacherProfile();
  } catch (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "Impossible d'accéder au profil enseignant."),
    );
  }
}

function buildStoragePath(input: {
  profileId: string;
  batchId: string;
  pageOrder: number;
  fileId: string;
  filename: string;
}): string {
  return buildProgrammationBatchStoragePath(input);
}

async function registerUploadedFile(input: {
  batchId: string;
  fileId: string;
  pageOrder: number;
  filename: string;
  mimeType: string;
  storagePath: string;
  fileSize: number;
}): Promise<boolean> {
  const { error: insertError } = await (await floraDb()).from("programming_import_files").insert({
    id: input.fileId,
    batch_id: input.batchId,
    page_order: input.pageOrder,
    filename: input.filename,
    mime_type: input.mimeType,
    storage_path: input.storagePath,
    file_size_bytes: input.fileSize,
    analysis_status: "uploaded",
    pdf_page_number: null,
    source_file_id: null,
  });

  if (insertError) {
    if (!isMissingProgrammingImportTable(insertError)) {
      devLog("[ProgrammingImport] upload-db-warning", {
        fileId: input.fileId,
        message: getSupabaseErrorMessage(insertError, "insert failed"),
      });
    }
    return false;
  }

  await (await floraDb())
    .from("programming_import_batches")
    .update({ status: "uploading", updated_at: new Date().toISOString() })
    .eq("id", input.batchId);

  return true;
}

export async function createProgrammingImportBatch(input?: {
  schoolYear?: string;
  mergeMode?: ImportBatchMergeMode;
  batchId?: string;
}): Promise<{ batchId: string; persisted: boolean }> {
  const bundle = await resolveProfileBundle();

  const batchId = input?.batchId ?? randomUUID();

  const { data, error } = await (await floraDb())
    .from("programming_import_batches")
    .insert({
      id: batchId,
      teacher_profile_id: bundle.profile.id,
      school_year: input?.schoolYear ?? bundle.profile.schoolYear,
      status: "draft",
      merge_mode: input?.mergeMode ?? "single_document",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingProgrammingImportTable(error)) {
      devLog("[ProgrammingImport] batch-create-fallback", { batchId });
      return { batchId, persisted: false };
    }
    throw new Error(
      getSupabaseErrorMessage(error, "Le lot d'import n'a pas pu être créé."),
    );
  }

  return { batchId: String(data.id), persisted: true };
}

export async function prepareProgrammingImportBatchUpload(input: {
  batchId: string;
  pageOrder: number;
  clientFileId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<{
  fileId: string;
  storagePath: string;
  mode: "direct" | "api";
  uploadUrl?: string;
}> {
  const bundle = await resolveProfileBundle();
  const resolvedName = resolveImportFileName({ name: input.fileName, type: input.mimeType });
  const validation = validateBatchFiles([
    {
      name: resolvedName,
      type: input.mimeType,
      size: input.fileSize,
      lastModified: Date.now(),
    },
  ]);
  if (!validation.ok) throw new Error(validation.error);

  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    profileId: bundle.profile.id,
    batchId: input.batchId,
    pageOrder: input.pageOrder,
    fileId,
    filename: resolvedName,
  });

  const useDirect =
    canUseDirectUpload() && input.fileSize >= PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES;

  if (useDirect) {
    try {
      const uploadUrl = await storageService.getSignedUploadUrl(storagePath, {
        contentType: input.mimeType || "application/octet-stream",
      });
      return { fileId, storagePath, mode: "direct", uploadUrl };
    } catch (error) {
      devLog("[ProgrammingImport] direct-upload-unavailable", {
        message: getSupabaseErrorMessage(error, "signed upload failed"),
      });
    }
  }

  return { fileId, storagePath, mode: "api" };
}

export async function confirmProgrammingImportBatchUpload(input: {
  batchId: string;
  fileId: string;
  storagePath: string;
  pageOrder: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<{
  entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
  persisted: boolean;
}> {
  const resolvedName = resolveImportFileName({ name: input.fileName, type: input.mimeType });
  const exists = await storageService.exists(input.storagePath);
  if (!exists) {
    throw new Error(`La page ${input.pageOrder} n'a pas pu être téléversée (fichier introuvable).`);
  }

  const persisted = await registerUploadedFile({
    batchId: input.batchId,
    fileId: input.fileId,
    pageOrder: input.pageOrder,
    filename: resolvedName,
    mimeType: input.mimeType || "application/octet-stream",
    storagePath: input.storagePath,
    fileSize: input.fileSize,
  });

  return {
    entries: [{ fileId: input.fileId, pageOrder: input.pageOrder, storagePath: input.storagePath }],
    persisted,
  };
}

export async function uploadProgrammingImportBatchFile(input: {
  batchId: string;
  file: File;
  pageOrder: number;
  clientFileId?: string;
}): Promise<{
  entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
  persisted: boolean;
}> {
  const bundle = await resolveProfileBundle();

  const resolvedName = resolveImportFileName(input.file);
  const validation = validateBatchFiles([
    {
      name: resolvedName,
      type: input.file.type,
      size: input.file.size,
      lastModified: input.file.lastModified,
    },
  ]);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    profileId: bundle.profile.id,
    batchId: input.batchId,
    pageOrder: input.pageOrder,
    fileId,
    filename: resolvedName,
  });

  try {
    await storageService.upload({
      key: storagePath,
      body: buffer,
      contentType: input.file.type || "application/octet-stream",
      fileName: resolvedName,
    });
  } catch (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        `La page ${input.pageOrder} n'a pas pu être téléversée vers le stockage.`,
      ),
    );
  }

  const persisted = await registerUploadedFile({
    batchId: input.batchId,
    fileId,
    pageOrder: input.pageOrder,
    filename: resolvedName,
    mimeType: input.file.type || "application/octet-stream",
    storagePath,
    fileSize: input.file.size,
  });

  return {
    entries: [{ fileId, pageOrder: input.pageOrder, storagePath }],
    persisted,
  };
}

async function resolveAnalyzeBuffer(input: {
  buffer: Buffer;
  storagePath?: string;
  pageOrder: number;
}): Promise<Buffer> {
  if (input.buffer.length > 0) {
    return input.buffer;
  }

  if (input.storagePath) {
    return downloadBatchFileBuffer(input.storagePath);
  }

  throw new ProgrammingImportError(
    "file_not_accessible",
    `La page ${input.pageOrder} n'a pas pu être lue : fichier vide ou inaccessible.`,
    { pageOrder: input.pageOrder },
  );
}

async function analyzeFileBuffer(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pdfPageNumber?: number;
}): Promise<ParsedProgrammationImport> {
  const resolvedName = resolveImportFileName({ name: input.fileName, type: input.mimeType ?? "" });
  const ext = resolveFileExtension(resolvedName, input.mimeType);

  if (input.pdfPageNumber && ext === ".pdf") {
    const pages = await extractPdfPageTexts(input.buffer);
    const pageIndex = Math.max(0, (input.pdfPageNumber ?? 1) - 1);
    const pageText = pages[pageIndex] ?? pages[0] ?? "";
    const parsed = await parseProgrammationFile({
      fileName: `${resolvedName} (p.${input.pdfPageNumber})`,
      buffer: Buffer.from(pageText, "utf8"),
      pastedText: pageText,
    });
    return parsed;
  }

  if (ext === ".pdf") {
    const pages = await extractPdfPageTexts(input.buffer);
    if (pages.length > 1) {
      const mergedText = pages.join("\n\n");
      return parseProgrammationFile({
        fileName: resolvedName,
        buffer: Buffer.from(mergedText, "utf8"),
        pastedText: mergedText,
      });
    }
  }

  const parsed = await parseProgrammationFile({
    fileName: resolvedName,
    buffer: input.buffer,
    mimeType: input.mimeType,
  });

  const validation = validateProgrammingAnalysisResponse(parsed);
  if (!validation.ok) {
    devLog("[ProgrammingImport] analyze-soft-warning", {
      fileName: resolvedName,
      warning: validation.error,
      previewLength: parsed.extractedTextPreview?.length ?? 0,
    });
    parsed.warnings.push(validation.error);
  }

  return parsed;
}

async function downloadBatchFileBuffer(storagePath: string): Promise<Buffer> {
  try {
    devLog("[ProgrammingImport] download-start", { storagePath });
    const downloaded = await storageService.download(storagePath);
    if (!downloaded.body.length) {
      throw new ProgrammingImportError(
        "file_not_accessible",
        "Le fichier téléversé est vide ou illisible.",
        { details: storagePath },
      );
    }
    devLog("[ProgrammingImport] download-success", { storagePath, bytes: downloaded.body.length });
    return downloaded.body;
  } catch (error) {
    if (error instanceof ProgrammingImportError) throw error;
    throw new ProgrammingImportError(
      "storage_download_failed",
      "Le fichier téléversé n'est plus accessible. Réessayez l'analyse ou remplacez la page.",
      { details: getSupabaseErrorMessage(error, "download failed") },
    );
  }
}

async function analyzeStoredFile(file: Pick<FileRow, "filename" | "mime_type" | "storage_path" | "pdf_page_number">): Promise<ParsedProgrammationImport> {
  const buffer = await downloadBatchFileBuffer(file.storage_path);
  return analyzeFileBuffer({
    fileName: file.filename,
    buffer,
    mimeType: file.mime_type,
    pdfPageNumber: file.pdf_page_number ?? undefined,
  });
}

function toFileRows(
  descriptors: ProgrammingImportUploadedFileDescriptor[],
  batchId: string,
): FileRow[] {
  return descriptors.map((file) => ({
    id: file.fileId,
    batch_id: batchId,
    page_order: file.pageOrder,
    filename: file.filename,
    mime_type: file.mimeType,
    storage_path: file.storagePath,
    file_size_bytes: 0,
    analysis_status: "uploaded" as ImportedFileStatus,
    analysis_error: "",
    parsed_snapshot: null,
    pdf_page_number: file.pdfPageNumber ?? null,
    source_file_id: null,
  }));
}

export async function analyzeProgrammingImportBatch(
  batchId: string,
  options?: {
    mergeMode?: ImportBatchMergeMode;
    files?: ProgrammingImportUploadedFileDescriptor[];
  },
): Promise<{
  parsed: ParsedProgrammationImport;
  files: Array<{
    fileId: string;
    pageOrder: number;
    status: ImportedFileStatus;
    error?: string;
  }>;
}> {
  let mergeMode: ImportBatchMergeMode = options?.mergeMode ?? "single_document";
  let files: FileRow[] = [];

  const { data: batch, error: batchError } = await (await floraDb())
    .from("programming_import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batch && !batchError) {
    mergeMode = (batch as BatchRow).merge_mode ?? mergeMode;
    await (await floraDb())
      .from("programming_import_batches")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", batchId);
  }

  if (options?.files?.length) {
    files = toFileRows(options.files, batchId);
  } else {
    const { data: fileRows, error: filesError } = await (await floraDb())
      .from("programming_import_files")
      .select("*")
      .eq("batch_id", batchId)
      .order("page_order", { ascending: true });

    if (filesError && !isMissingProgrammingImportTable(filesError)) {
      throw new Error(getSupabaseErrorMessage(filesError, "Impossible de charger les fichiers du lot."));
    }

    files = (fileRows ?? []) as FileRow[];
  }

  if (files.length === 0) {
    throw new Error("Aucun fichier téléversé dans ce lot.");
  }

  const pageResults: PageParseResult[] = [];
  const statuses: Array<{
    fileId: string;
    pageOrder: number;
    status: ImportedFileStatus;
    error?: string;
  }> = [];

  for (const file of files) {
    await (await floraDb())
      .from("programming_import_files")
      .update({ analysis_status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", file.id);

    try {
      const parsed = await analyzeStoredFile(file);
      pageResults.push({
        pageOrder: file.page_order,
        fileId: file.id,
        fileName: file.filename,
        storagePath: file.storage_path,
        pdfPageNumber: file.pdf_page_number ?? undefined,
        parsed,
      });

      await (await floraDb())
        .from("programming_import_files")
        .update({
          analysis_status: "analyzed",
          parsed_snapshot: parsed,
          analysis_error: "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      statuses.push({
        fileId: file.id,
        pageOrder: file.page_order,
        status: "analyzed",
      });
    } catch (error) {
      const message = mapProgrammingImportErrorMessage(error);
      await (await floraDb())
        .from("programming_import_files")
        .update({
          analysis_status: "error",
          analysis_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      statuses.push({
        fileId: file.id,
        pageOrder: file.page_order,
        status: "error",
        error: message,
      });
    }
  }

  const parsed = mergeProgrammationPages(batchId, pageResults);
  if (parsed.batchMeta) {
    parsed.batchMeta.mergeMode = mergeMode;
  }

  if (statuses.some((item) => item.status === "error")) {
    parsed.warnings.push(
      "Certaines pages n'ont pas pu être analysées. Vous pouvez les remplacer ou continuer sans elles.",
    );
  }

  if (pageResults.length === 0) {
    const failedPages = statuses.filter((item) => item.status === "error");
    const firstError = failedPages[0]?.error ?? "Analyse impossible.";
    const emptyParsed = mergeProgrammationPages(batchId, []);
    if (emptyParsed.batchMeta) emptyParsed.batchMeta.mergeMode = mergeMode;
    emptyParsed.warnings.push(
      failedPages.length > 0
        ? `La page ${failedPages[0]?.pageOrder ?? "?"} n'a pas pu être lue : ${firstError}`
        : "Les images ont été téléversées, mais leur analyse a échoué.",
      "Les fichiers restent téléversés. Vous pouvez réessayer l'analyse ou continuer vers l'étape suivante.",
    );

    await (await floraDb())
      .from("programming_import_batches")
      .update({
        status: "error",
        parsed_snapshot: emptyParsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    return { parsed: emptyParsed, files: statuses };
  }

  await (await floraDb())
    .from("programming_import_batches")
    .update({
      status: pageResults.length > 0 ? "ready" : "error",
      parsed_snapshot: parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return { parsed, files: statuses };
}

export async function analyzeProgrammingImportBatchInline(input: {
  batchId: string;
  mergeMode?: ImportBatchMergeMode;
  pages: Array<{
    fileId: string;
    pageOrder: number;
    filename: string;
    mimeType: string;
    storagePath?: string;
    buffer: Buffer;
    pdfPageNumber?: number;
  }>;
}): Promise<{
  parsed: ParsedProgrammationImport;
  files: Array<{
    fileId: string;
    pageOrder: number;
    status: ImportedFileStatus;
    error?: string;
  }>;
}> {
  const mergeMode = input.mergeMode ?? "single_document";
  devLog("[ProgrammingImport] analyze-start", {
    batchId: input.batchId,
    fileCount: input.pages.length,
    mergeMode,
  });

  const pageResults: PageParseResult[] = [];
  const statuses: Array<{
    fileId: string;
    pageOrder: number;
    status: ImportedFileStatus;
    error?: string;
  }> = [];

  for (const page of input.pages) {
    devLog("[ProgrammingImport] analyze-file-start", {
      fileId: page.fileId,
      pageOrder: page.pageOrder,
      fileName: page.filename,
      mimeType: page.mimeType,
      storagePath: page.storagePath,
      bytes: page.buffer.length,
    });

    try {
      const buffer = await resolveAnalyzeBuffer({
        buffer: page.buffer,
        storagePath: page.storagePath,
        pageOrder: page.pageOrder,
      });

      const parsed = await analyzeFileBuffer({
        fileName: page.filename,
        buffer,
        mimeType: page.mimeType,
        pdfPageNumber: page.pdfPageNumber,
      });

      pageResults.push({
        pageOrder: page.pageOrder,
        fileId: page.fileId,
        fileName: page.filename,
        storagePath: page.storagePath,
        pdfPageNumber: page.pdfPageNumber,
        parsed,
      });

      statuses.push({ fileId: page.fileId, pageOrder: page.pageOrder, status: "analyzed" });
      devLog("[ProgrammingImport] analyze-file-success", { fileId: page.fileId });
    } catch (error) {
      const message = mapProgrammingImportErrorMessage(error);
      devLog("[ProgrammingImport] analyze-failed", {
        batchId: input.batchId,
        fileId: page.fileId,
        step: "analyze",
        errorMessage: message,
      });
      statuses.push({
        fileId: page.fileId,
        pageOrder: page.pageOrder,
        status: "error",
        error: message,
      });
    }
  }

  devLog("[ProgrammingImport] merge-start", { batchId: input.batchId });
  const parsed = mergeProgrammationPages(input.batchId, pageResults);
  if (parsed.batchMeta) parsed.batchMeta.mergeMode = mergeMode;

  if (statuses.some((item) => item.status === "error")) {
    parsed.warnings.push(
      "Certaines pages n'ont pas pu être analysées. Vous pouvez les remplacer ou continuer sans elles.",
    );
  }

  if (pageResults.length === 0) {
    const failedPages = statuses.filter((item) => item.status === "error");
    const firstError = failedPages[0]?.error ?? "Analyse impossible.";
    const parsed = mergeProgrammationPages(input.batchId, []);
    if (parsed.batchMeta) parsed.batchMeta.mergeMode = mergeMode;
    parsed.warnings.push(
      failedPages.length > 0
        ? `La page ${failedPages[0]?.pageOrder ?? "?"} n'a pas pu être lue : ${firstError}`
        : "Aucune page n'a pu être analysée automatiquement.",
      "Les fichiers restent téléversés. Vous pouvez réessayer l'analyse ou continuer vers l'étape suivante.",
    );
    devLog("[ProgrammingImport] analyze-completed-empty", { batchId: input.batchId });
    return { parsed, files: statuses };
  }

  devLog("[ProgrammingImport] analyze-completed", { batchId: input.batchId, rows: parsed.rowCount });
  return { parsed, files: statuses };
}

export async function loadProgrammingImportBatchDraft(batchId: string) {
  const { data: batch, error } = await (await floraDb())
    .from("programming_import_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (error || !batch) throw new Error("Lot introuvable.");

  const { data: files } = await (await floraDb())
    .from("programming_import_files")
    .select("*")
    .eq("batch_id", batchId)
    .order("page_order", { ascending: true });

  return { batch, files: files ?? [] };
}

export async function updateProgrammingImportBatchOrder(
  batchId: string,
  orderedFileIds: string[],
): Promise<void> {
  for (let index = 0; index < orderedFileIds.length; index += 1) {
    const fileId = orderedFileIds[index];
    if (!isValidImportUuid(fileId)) {
      devLog("[ProgrammingImport] reorder-skip-invalid-id", { fileId, index });
      continue;
    }

    const { error } = await (await floraDb())
      .from("programming_import_files")
      .update({
        page_order: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId)
      .eq("batch_id", batchId);

    if (error && !isMissingProgrammingImportTable(error)) {
      throw new Error(getSupabaseErrorMessage(error, "Réorganisation impossible."));
    }
  }
}
