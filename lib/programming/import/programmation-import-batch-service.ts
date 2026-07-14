import "server-only";

import { randomUUID } from "node:crypto";
import { resolveImportFileName } from "@/lib/import/accepted-formats";
import { devLog } from "@/lib/logger";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  buildProgrammationBatchStoragePath,
  getStorageBucketName,
} from "@/lib/supabase/storage-config";
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

export async function createProgrammingImportBatch(input?: {
  schoolYear?: string;
  mergeMode?: ImportBatchMergeMode;
  batchId?: string;
}): Promise<{ batchId: string; persisted: boolean }> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) {
    throw new Error("Votre session a expiré. Reconnectez-vous puis réessayez.");
  }

  const batchId = input?.batchId ?? randomUUID();

  const { data, error } = await supabase
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

export async function uploadProgrammingImportBatchFile(input: {
  batchId: string;
  file: File;
  pageOrder: number;
  clientFileId?: string;
}): Promise<{
  entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
  publicUrl: string;
  persisted: boolean;
}> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) {
    throw new Error("Votre session a expiré. Reconnectez-vous puis réessayez.");
  }

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

  const bucket = getStorageBucketName();
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const fileId = input.clientFileId ?? randomUUID();
  const storagePath = buildProgrammationBatchStoragePath({
    profileId: bundle.profile.id,
    batchId: input.batchId,
    pageOrder: input.pageOrder,
    fileId,
    filename: resolvedName,
  });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(
      getSupabaseErrorMessage(
        uploadError,
        `La page ${input.pageOrder} n'a pas pu être téléversée.`,
      ),
    );
  }

  let persisted = true;
  const { error: insertError } = await supabase.from("programming_import_files").insert({
    id: fileId,
    batch_id: input.batchId,
    page_order: input.pageOrder,
    filename: resolvedName,
    mime_type: input.file.type || "application/octet-stream",
    storage_path: storagePath,
    file_size_bytes: input.file.size,
    analysis_status: "uploaded",
    pdf_page_number: null,
    source_file_id: null,
  });

  if (insertError) {
    persisted = false;
    if (!isMissingProgrammingImportTable(insertError)) {
      devLog("[ProgrammingImport] upload-db-warning", {
        fileId,
        message: getSupabaseErrorMessage(insertError, "insert failed"),
      });
    }
  }

  await supabase
    .from("programming_import_batches")
    .update({ status: "uploading", updated_at: new Date().toISOString() })
    .eq("id", input.batchId);

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    entries: [{ fileId, pageOrder: input.pageOrder, storagePath }],
    publicUrl: publicUrlData.publicUrl,
    persisted,
  };
}

async function downloadBatchFileBuffer(storagePath: string): Promise<Buffer> {
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error("Fichier source introuvable.");
  return Buffer.from(await data.arrayBuffer());
}

async function analyzeStoredFile(file: Pick<FileRow, "filename" | "mime_type" | "storage_path" | "pdf_page_number">): Promise<ParsedProgrammationImport> {
  const buffer = await downloadBatchFileBuffer(file.storage_path);
  const lower = file.filename.toLowerCase();

  if (file.pdf_page_number && lower.endsWith(".pdf")) {
    const pages = await extractPdfPageTexts(buffer);
    const pageIndex = Math.max(0, (file.pdf_page_number ?? 1) - 1);
    const pageText = pages[pageIndex] ?? pages[0] ?? "";
    return parseProgrammationFile({
      fileName: `${file.filename} (p.${file.pdf_page_number})`,
      buffer: Buffer.from(pageText, "utf8"),
      pastedText: pageText,
    });
  }

  if (lower.endsWith(".pdf")) {
    const pages = await extractPdfPageTexts(buffer);
    if (pages.length > 1) {
      const mergedText = pages.join("\n\n");
      return parseProgrammationFile({
        fileName: file.filename,
        buffer: Buffer.from(mergedText, "utf8"),
        pastedText: mergedText,
      });
    }
  }

  return parseProgrammationFile({
    fileName: file.filename,
    buffer,
    mimeType: file.mime_type,
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

  const { data: batch, error: batchError } = await supabase
    .from("programming_import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batch && !batchError) {
    mergeMode = (batch as BatchRow).merge_mode ?? mergeMode;
    await supabase
      .from("programming_import_batches")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", batchId);
  }

  if (options?.files?.length) {
    files = toFileRows(options.files, batchId);
  } else {
    const { data: fileRows, error: filesError } = await supabase
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
    await supabase
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

      await supabase
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
      const message = error instanceof Error ? error.message : "Analyse impossible.";
      await supabase
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
    throw new Error("Les images ont été téléversées, mais leur analyse a échoué.");
  }

  await supabase
    .from("programming_import_batches")
    .update({
      status: pageResults.length > 0 ? "ready" : "error",
      parsed_snapshot: parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return { parsed, files: statuses };
}

export async function loadProgrammingImportBatchDraft(batchId: string) {
  const { data: batch, error } = await supabase
    .from("programming_import_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (error || !batch) throw new Error("Lot introuvable.");

  const { data: files } = await supabase
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
    const { error } = await supabase
      .from("programming_import_files")
      .update({
        page_order: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderedFileIds[index])
      .eq("batch_id", batchId);

    if (error && !isMissingProgrammingImportTable(error)) {
      throw new Error(getSupabaseErrorMessage(error, "Réorganisation impossible."));
    }
  }
}
