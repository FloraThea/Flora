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
  createProgrammingImportBatch,
  loadProgrammingImportBatchDraft,
  updateProgrammingImportBatchOrder,
  uploadProgrammingImportBatchFile,
} from "@/lib/programming/import/programmation-import-batch-service";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { AcademicZone, SchoolLevel } from "@/lib/programming/types";
import type { ProgrammationFormatConfig } from "@/lib/programming/import/types";
import type { ImportBatchMergeMode } from "@/lib/programming/import/batch-types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/programmation/import";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = String(formData.get("action") ?? "analyze");
      const file = formData.get("file");

      if (action === "batch_upload") {
        if (!(file instanceof File)) {
          return jsonRouteError(ROUTE_PATH, 400, "Fichier requis.");
        }
        const batchId = String(formData.get("batchId") ?? "");
        const pageOrder = Number(formData.get("pageOrder") ?? 1);
        if (!batchId) return jsonRouteError(ROUTE_PATH, 400, "batchId requis.");

        const uploaded = await uploadProgrammingImportBatchFile({ batchId, file, pageOrder });
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
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
      pastedText?: string;
      fileName?: string;
    };

    if (body.action === "batch_create") {
      const created = await createProgrammingImportBatch({
        schoolYear: body.schoolYear,
        mergeMode: body.mergeMode,
      });
      return NextResponse.json({ route: ROUTE_PATH, ...created });
    }

    if (body.action === "batch_reorder" && body.batchId && body.orderedFileIds?.length) {
      await updateProgrammingImportBatchOrder(body.batchId, body.orderedFileIds);
      return NextResponse.json({ route: ROUTE_PATH, ok: true });
    }

    if (body.action === "batch_analyze" && body.batchId) {
      logRouteInfo(ROUTE_PATH, "Analyse lot programmation", { batchId: body.batchId });
      const result = await analyzeProgrammingImportBatch(body.batchId);
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
    return jsonRouteError(ROUTE_PATH, 500, "Import programmation impossible.", toErrorMessage(error));
  }
}
