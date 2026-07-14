import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  analyzeProgressionImport,
  buildProgressionImportSession,
  saveImportedProgression,
  uploadProgressionImportFile,
} from "@/lib/progression/import/progression-import-service";
import type { ParsedProgressionImport } from "@/lib/progression/import/types";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";

const ROUTE_PATH = "/api/progression/import";

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
        const parsed = await analyzeProgressionImport({
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
        const uploaded = await uploadProgressionImportFile(bundle.profile.id, file);
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
      }

      return jsonRouteError(ROUTE_PATH, 400, "Action non reconnue.");
    }

    const body = (await request.json()) as {
      action?: string;
      parsed?: ParsedProgressionImport;
      programmationId?: string;
      methode?: string;
      title?: string;
      sourceStoragePath?: string;
      sourceFileName?: string;
      pastedText?: string;
      fileName?: string;
    };

    if (body.action === "analyze_text") {
      const parsed = await analyzeProgressionImport({
        fileName: body.fileName ?? "progression.txt",
        buffer: Buffer.from(body.pastedText ?? "", "utf8"),
        pastedText: body.pastedText,
      });
      return NextResponse.json({ route: ROUTE_PATH, parsed });
    }

    if (body.action === "preview" && body.parsed) {
      const session = await buildProgressionImportSession({
        parsed: body.parsed,
        programmationId: body.programmationId || null,
        methode: body.methode,
        title: body.title,
      });
      return NextResponse.json({ route: ROUTE_PATH, session });
    }

    if (body.action === "save" && body.parsed) {
      const session = await buildProgressionImportSession({
        parsed: body.parsed,
        programmationId: body.programmationId || null,
        methode: body.methode,
        title: body.title,
      });

      logRouteInfo(ROUTE_PATH, "Sauvegarde progression importée", {
        title: session.title,
        programmationId: body.programmationId ?? null,
        independent: !body.programmationId,
      });

      const payload = await saveImportedProgression({
        session,
        sourceFileName: body.sourceFileName,
        sourceStoragePath: body.sourceStoragePath,
      });

      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action ou paramètres invalides.");
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Import progression impossible.", toErrorMessage(error));
  }
}
