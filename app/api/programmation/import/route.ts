import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  analyzeProgrammationImport,
  buildImportSession,
  saveImportedProgrammation,
  uploadImportSourceFile,
} from "@/lib/programming/import/programmation-import-service";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { AcademicZone, SchoolLevel } from "@/lib/programming/types";
import type { ProgrammationFormatConfig } from "@/lib/programming/import/types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/programmation/import";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = String(formData.get("action") ?? "analyze");
      const file = formData.get("file");

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
      pastedText?: string;
      fileName?: string;
    };

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

      logRouteInfo(ROUTE_PATH, "Sauvegarde programmation importée", { title });

      const payload = await saveImportedProgrammation({
        session,
        title,
        sourceFileName: body.sourceFileName,
        sourceStoragePath: body.sourceStoragePath,
      });

      void pedagogicalEngine.genererCahierJournal(payload.programmation.id);

      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action ou paramètres invalides.");
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Import programmation impossible.", toErrorMessage(error));
  }
}
