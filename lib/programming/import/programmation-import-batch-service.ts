import "server-only";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import {
  buildProgrammationBatchStoragePath,
  getStorageBucketName,
} from "@/lib/supabase/storage-config";
import { validateBatchFiles } from "./batch-validation";
import { extractPdfPageTexts } from "./extract-pdf-pages";
import { mergeProgrammationPages, type PageParseResult } from "./merge-programmation-pages";
import { parseProgrammationFile } from "./parse-programmation";
import type {
  ImportBatchMergeMode,
  ImportBatchStatus,
  ImportedFileStatus,
} from "./batch-types";
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

export async function createProgrammingImportBatch(input?: {
  schoolYear?: string;
  mergeMode?: ImportBatchMergeMode;
}): Promise<{ batchId: string }> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) throw new Error("Profil enseignant requis.");

  const { data, error } = await supabase
    .from("programming_import_batches")
    .insert({
      teacher_profile_id: bundle.profile.id,
      school_year: input?.schoolYear ?? bundle.profile.schoolYear,
      status: "draft",
      merge_mode: input?.mergeMode ?? "single_document",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de créer le lot d'import."));
  }

  return { batchId: String(data.id) };
}

export async function uploadProgrammingImportBatchFile(input: {
  batchId: string;
  file: File;
  pageOrder: number;
}): Promise<{
  entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
  publicUrl: string;
}> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) throw new Error("Profil enseignant requis.");

  const validation = validateBatchFiles([input.file]);
  if (!validation.ok) throw new Error(validation.error);

  const bucket = getStorageBucketName();
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const lower = input.file.name.toLowerCase();
  const sourceFileId = randomUUID();

  let pageUnits: Array<{ pageOrder: number; pdfPageNumber?: number }> = [
    { pageOrder: input.pageOrder, pdfPageNumber: lower.endsWith(".pdf") ? 1 : undefined },
  ];

  if (lower.endsWith(".pdf")) {
    const pages = await extractPdfPageTexts(buffer);
    if (pages.length > 1) {
      pageUnits = pages.map((_, index) => ({
        pageOrder: input.pageOrder + index,
        pdfPageNumber: index + 1,
      }));
    }
  }

  const storagePath = buildProgrammationBatchStoragePath({
    profileId: bundle.profile.id,
    batchId: input.batchId,
    pageOrder: input.pageOrder,
    fileId: sourceFileId,
    filename: input.file.name,
  });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(getSupabaseErrorMessage(uploadError, "Téléversement impossible."));
  }

  const entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }> =
    [];

  for (const unit of pageUnits) {
    const fileId = randomUUID();
    const { error: insertError } = await supabase.from("programming_import_files").insert({
      id: fileId,
      batch_id: input.batchId,
      page_order: unit.pageOrder,
      filename: input.file.name,
      mime_type: input.file.type || "application/octet-stream",
      storage_path: storagePath,
      file_size_bytes: input.file.size,
      analysis_status: "uploaded",
      pdf_page_number: unit.pdfPageNumber ?? null,
      source_file_id: pageUnits.length > 1 ? sourceFileId : null,
    });

    if (insertError) {
      throw new Error(getSupabaseErrorMessage(insertError, "Enregistrement fichier impossible."));
    }

    entries.push({
      fileId,
      pageOrder: unit.pageOrder,
      pdfPageNumber: unit.pdfPageNumber,
      storagePath,
    });
  }

  await supabase
    .from("programming_import_batches")
    .update({ status: "uploading", updated_at: new Date().toISOString() })
    .eq("id", input.batchId);

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return { entries, publicUrl: publicUrlData.publicUrl };
}

async function downloadBatchFileBuffer(storagePath: string): Promise<Buffer> {
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error("Fichier source introuvable.");
  return Buffer.from(await data.arrayBuffer());
}

async function analyzeStoredFile(file: FileRow): Promise<ParsedProgrammationImport> {
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

  if (lower.endsWith(".pdf") && !file.pdf_page_number) {
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

export async function analyzeProgrammingImportBatch(batchId: string): Promise<{
  parsed: ParsedProgrammationImport;
  files: Array<{
    fileId: string;
    pageOrder: number;
    status: ImportedFileStatus;
    error?: string;
  }>;
}> {
  const { data: batch, error: batchError } = await supabase
    .from("programming_import_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (batchError || !batch) throw new Error("Lot d'import introuvable.");

  await supabase
    .from("programming_import_batches")
    .update({ status: "analyzing", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: fileRows, error: filesError } = await supabase
    .from("programming_import_files")
    .select("*")
    .eq("batch_id", batchId)
    .order("page_order", { ascending: true });

  if (filesError) throw new Error(filesError.message);
  const files = (fileRows ?? []) as FileRow[];

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

  const mergeMode = (batch as BatchRow).merge_mode ?? "single_document";
  let parsed: ParsedProgrammationImport;

  if (mergeMode === "multiple_programmations") {
    parsed = mergeProgrammationPages(batchId, pageResults);
  } else {
    parsed = mergeProgrammationPages(batchId, pageResults);
  }

  if (statuses.some((item) => item.status === "error")) {
    parsed.warnings.push(
      "Certaines pages n'ont pas pu être analysées. Vous pouvez les remplacer ou continuer sans elles.",
    );
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
    await supabase
      .from("programming_import_files")
      .update({
        page_order: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderedFileIds[index])
      .eq("batch_id", batchId);
  }
}
