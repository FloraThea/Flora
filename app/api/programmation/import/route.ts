import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  analyzeProgrammationImport,
  buildImportSession,
  saveImportedProgrammation,
  uploadImportSourceFile,
} from "@/lib/programming/import/programmation-import-service";
import {
  analyzeProgrammingImportBatch,
  analyzeProgrammingImportBatchInline,
  confirmProgrammingImportBatchUpload,
  createProgrammingImportBatch,
  loadProgrammingImportBatchDraft,
  prepareProgrammingImportBatchUpload,
  updateProgrammingImportBatchOrder,
  uploadProgrammingImportBatchFile,
} from "@/lib/programming/import/programmation-import-batch-service";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { AcademicZone, SchoolLevel } from "@/lib/programming/types";
import type { ProgrammationFormatConfig } from "@/lib/programming/import/types";
import type { ImportBatchMergeMode, ProgrammingImportUploadedFileDescriptor } from "@/lib/programming/import/batch-types";
import {
  ProgrammingImportError,
} from "@/lib/programming/import/programming-import-errors";
import { resolveImportFileName } from "@/lib/import/accepted-formats";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/programmation/import";

export const maxDuration = 300;

function mapImportStepError(action: string | undefined, error: unknown): { status: number; message: string } {
  const details = toErrorMessage(error).toLowerCase();

  if (details.includes("session") || details.includes("profil")) {
    return { status: 401, message: "Votre session a expiré. Reconnectez-vous puis réessayez." };
  }
  if (details.includes("stockage") || details.includes("storage") || details.includes("r2") || details.includes("bucket")) {
    return { status: 500, message: toErrorMessage(error) || "Le téléversement vers le stockage a échoué." };
  }
  if (action === "batch_create") {
    return { status: 500, message: toErrorMessage(error) || "Impossible de créer le lot d'import." };
  }
  if (action === "batch_upload_prepare" || action === "batch_upload_confirm" || action === "batch_upload") {
    return { status: 500, message: toErrorMessage(error) || "Le téléversement des fichiers a échoué." };
  }
  if (error instanceof ProgrammingImportError) {
    return { status: 500, message: error.message };
  }

  if (action === "batch_analyze" || action === "batch_analyze_inline") {
    return { status: 500, message: toErrorMessage(error) || "L'analyse des pages a échoué." };
  }
  if (action === "save") {
    return { status: 500, message: toErrorMessage(error) || "La programmation n'a pas pu être enregistrée." };
  }

  return { status: 500, message: toErrorMessage(error) || "Une erreur inattendue est survenue pendant l'import." };
}

export async function POST(request: Request) {
  let action: string | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      action = String(formData.get("action") ?? "analyze");
      const file = formData.get("file");

      if (action === "batch_upload") {
        if (!(file instanceof File)) {
          return jsonRouteError(ROUTE_PATH, 400, "Fichier requis.");
        }
        const batchId = String(formData.get("batchId") ?? "");
        const pageOrder = Number(formData.get("pageOrder") ?? 1);
        const clientFileId = String(formData.get("clientFileId") ?? "") || undefined;
        if (!batchId) return jsonRouteError(ROUTE_PATH, 400, "batchId requis.");

        logRouteInfo(ROUTE_PATH, "Upload lot programmation", { batchId, pageOrder, fileName: file.name });
        const uploaded = await uploadProgrammingImportBatchFile({
          batchId,
          file,
          pageOrder,
          clientFileId,
        });
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
      }

      if (action === "batch_analyze_inline") {
        const batchId = String(formData.get("batchId") ?? "");
        const mergeMode = String(formData.get("mergeMode") ?? "single_document") as ImportBatchMergeMode;
        const metadataRaw = String(formData.get("pagesMetadata") ?? "[]");
        if (!batchId) return jsonRouteError(ROUTE_PATH, 400, "batchId requis.");

        let metadata: Array<{
          fileId: string;
          pageOrder: number;
          filename: string;
          mimeType: string;
          storagePath?: string;
          pdfPageNumber?: number;
        }>;

        try {
          metadata = JSON.parse(metadataRaw);
        } catch {
          return jsonRouteError(ROUTE_PATH, 400, "Métadonnées des pages invalides.");
        }

        if (!Array.isArray(metadata) || metadata.length === 0) {
          return jsonRouteError(ROUTE_PATH, 400, "Aucune page à analyser.");
        }

        logRouteInfo(ROUTE_PATH, "Analyse inline lot programmation", {
          batchId,
          fileCount: metadata.length,
          mergeMode,
        });

        const pages = await Promise.all(
          metadata.map(async (meta) => {
            const pageFile = formData.get(`file_${meta.fileId}`);
            if (!(pageFile instanceof File)) {
              throw new ProgrammingImportError(
                "file_not_accessible",
                `La page ${meta.pageOrder} n'a pas pu être lue : fichier manquant dans la requête.`,
                { fileId: meta.fileId, pageOrder: meta.pageOrder },
              );
            }
            const buffer = Buffer.from(await pageFile.arrayBuffer());
            return {
              ...meta,
              filename: resolveImportFileName(pageFile),
              mimeType: pageFile.type || meta.mimeType,
              buffer,
            };
          }),
        );

        const result = await analyzeProgrammingImportBatchInline({
          batchId,
          mergeMode,
          pages,
        });
        return NextResponse.json({ route: ROUTE_PATH, ...result });
      }

      if (!(file instanceof File)) {
        return jsonRouteError(ROUTE_PATH, 400, "Fichier requis.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pastedText = String(formData.get("pastedText") ?? "");

      if (action === "analyze") {
        const parsed = await analyzeProgrammationImport({
          fileName: file.name,
          buffer,
          mimeType: file.type,
          pastedText: pastedText || undefined,
        });
        return NextResponse.json({ route: ROUTE_PATH, parsed });
      }

      if (action === "upload") {
        const bundle = await loadTeacherProfileBundle();
        if (!bundle) return jsonRouteError(ROUTE_PATH, 401, "Profil requis.");
        const uploaded = await uploadImportSourceFile(bundle.profile.id, file);
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
      }

      return jsonRouteError(ROUTE_PATH, 400, "Action non reconnue.");
    }

    const body = (await request.json()) as {
      action?: string;
      parsed?: Awaited<ReturnType<typeof analyzeProgrammationImport>>;
      schoolYear?: string;
      academicZone?: AcademicZone;
      levels?: SchoolLevel[];
      matiere?: string;
      title?: string;
      formatConfig?: ProgrammationFormatConfig;
      sourceStoragePath?: string;
      sourceFileName?: string;
      sourceStoragePaths?: string[];
      batchId?: string;
      mergeMode?: ImportBatchMergeMode;
      orderedFileIds?: string[];
      uploadedFiles?: ProgrammingImportUploadedFileDescriptor[];
      clientFileId?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      storagePath?: string;
      fileId?: string;
      pageOrder?: number;
      pastedText?: string;
    };

    action = body.action;

    if (body.action === "batch_upload_prepare" && body.batchId) {
      const prepared = await prepareProgrammingImportBatchUpload({
        batchId: body.batchId,
        pageOrder: Number(body.pageOrder ?? 1),
        clientFileId: body.clientFileId,
        fileName: body.fileName ?? "import.png",
        mimeType: body.mimeType ?? "application/octet-stream",
        fileSize: Number(body.fileSize ?? 0),
      });
      return NextResponse.json({ route: ROUTE_PATH, ...prepared });
    }

    if (
      body.action === "batch_upload_confirm" &&
      body.batchId &&
      body.fileId &&
      body.storagePath
    ) {
      const confirmed = await confirmProgrammingImportBatchUpload({
        batchId: body.batchId,
        fileId: body.fileId,
        storagePath: body.storagePath,
        pageOrder: Number(body.pageOrder ?? 1),
        fileName: body.fileName ?? "import.png",
        mimeType: body.mimeType ?? "application/octet-stream",
        fileSize: Number(body.fileSize ?? 0),
      });
      return NextResponse.json({ route: ROUTE_PATH, ...confirmed });
    }

    if (body.action === "batch_create") {
      logRouteInfo(ROUTE_PATH, "Création lot programmation", { batchId: body.batchId });
      const created = await createProgrammingImportBatch({
        schoolYear: body.schoolYear,
        mergeMode: body.mergeMode,
        batchId: body.batchId,
      });
      return NextResponse.json({ route: ROUTE_PATH, ...created });
    }

    if (body.action === "batch_reorder" && body.batchId && body.orderedFileIds?.length) {
      await updateProgrammingImportBatchOrder(body.batchId, body.orderedFileIds);
      return NextResponse.json({ route: ROUTE_PATH, ok: true });
    }

    if (body.action === "batch_analyze" && body.batchId) {
      logRouteInfo(ROUTE_PATH, "Analyse lot programmation", {
        batchId: body.batchId,
        fileCount: body.uploadedFiles?.length ?? 0,
      });
      const result = await analyzeProgrammingImportBatch(body.batchId, {
        mergeMode: body.mergeMode,
        files: body.uploadedFiles,
      });
      return NextResponse.json({ route: ROUTE_PATH, ...result });
    }

    if (body.action === "batch_load" && body.batchId) {
      const draft = await loadProgrammingImportBatchDraft(body.batchId);
      return NextResponse.json({ route: ROUTE_PATH, ...draft });
    }

    if (body.action === "analyze_text") {
      const parsed = await analyzeProgrammationImport({
        fileName: body.fileName ?? "coller.txt",
        buffer: Buffer.from(body.pastedText ?? "", "utf8"),
        pastedText: body.pastedText,
      });
      return NextResponse.json({ route: ROUTE_PATH, parsed });
    }

    if (body.action === "adapt" && body.parsed && body.schoolYear && body.academicZone) {
      const session = await buildImportSession({
        parsed: body.parsed,
        schoolYear: body.schoolYear,
        academicZone: body.academicZone,
        levels: body.levels ?? ["CM2"],
        matiere: body.matiere ?? body.parsed.discipline,
        formatConfig: body.formatConfig,
      });
      return NextResponse.json({ route: ROUTE_PATH, session });
    }

    if (body.action === "save" && body.parsed && body.schoolYear && body.academicZone) {
      const session = await buildImportSession({
        parsed: body.parsed,
        schoolYear: body.schoolYear,
        academicZone: body.academicZone,
        levels: body.levels ?? ["CM2"],
        matiere: body.matiere ?? body.parsed.discipline,
        formatConfig: body.formatConfig,
      });

      const title =
        body.title ??
        `Import ${body.parsed.discipline || body.matiere || "programmation"} ${body.schoolYear}`;

      const sourceStoragePath =
        body.sourceStoragePath ??
        body.sourceStoragePaths?.[0] ??
        body.parsed.batchMeta?.sourceFiles[0]?.storagePath ??
        "";

      logRouteInfo(ROUTE_PATH, "Sauvegarde programmation importée", {
        title,
        batchId: body.parsed.batchMeta?.batchId,
      });

      const payload = await saveImportedProgrammation({
        session,
        title,
        sourceFileName: body.sourceFileName ?? body.parsed.fileName,
        sourceStoragePath,
      });

      void pedagogicalEngine.genererCahierJournal(payload.programmation.id);

      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action ou paramètres invalides.");
  } catch (error) {
    const mapped = mapImportStepError(action, error);
    console.error("[ProgrammingImport] failed", {
      step: action ?? "unknown",
      error: toErrorMessage(error),
    });
    return jsonRouteError(
      ROUTE_PATH,
      mapped.status,
      mapped.message,
      toErrorMessage(error),
      { step: action ?? "unknown" },
      error,
    );
  }
}
