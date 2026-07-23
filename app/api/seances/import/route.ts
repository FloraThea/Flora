import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  analyzeSeanceImport,
  buildSeanceImportSession,
  requireSeanceImportProfileId,
  saveImportedSeances,
  uploadSeanceImportFile,
} from "@/lib/seances/import/seance-import-service";
import type { ParsedSeanceImport } from "@/lib/seances/import/types";
import { triggerPedagogicalAnalysis } from "@/lib/pedagogical/intelligence/coherence-trigger";

const ROUTE_PATH = "/api/seances/import";

export async function POST(request: Request) {
  let action: string | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      action = String(formData.get("action") ?? "analyze");
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return jsonRouteError(ROUTE_PATH, 400, "Fichier requis.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pastedText = String(formData.get("pastedText") ?? "");

      if (action === "analyze") {
        const parsed = await analyzeSeanceImport({
          fileName: file.name,
          buffer,
          mimeType: file.type,
          pastedText: pastedText || undefined,
        });
        return NextResponse.json({ route: ROUTE_PATH, parsed });
      }

      if (action === "upload") {
        const profileId = await requireSeanceImportProfileId();
        const uploaded = await uploadSeanceImportFile(profileId, file);
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
      }

      return jsonRouteError(ROUTE_PATH, 400, "Action non reconnue.");
    }

    const body = (await request.json()) as {
      action?: string;
      parsed?: ParsedSeanceImport;
      title?: string;
      matiere?: string;
      sousMatiere?: string;
      niveau?: string;
      methode?: string;
      periodNumber?: number;
      weekNumber?: number;
      sourceStoragePath?: string;
      sourceFileName?: string;
      selectedLinks?: import("@/lib/seances/import/types").SeanceImportSession["selectedLinks"];
      pastedText?: string;
      fileName?: string;
    };

    action = body.action;

    if (body.action === "analyze_text") {
      const parsed = await analyzeSeanceImport({
        fileName: body.fileName ?? "seance.txt",
        buffer: Buffer.from(body.pastedText ?? "", "utf8"),
        pastedText: body.pastedText,
      });
      return NextResponse.json({ route: ROUTE_PATH, parsed });
    }

    if (body.action === "preview" && body.parsed) {
      const session = await buildSeanceImportSession({
        parsed: body.parsed,
        title: body.title,
        matiere: body.matiere,
        sousMatiere: body.sousMatiere,
        niveau: body.niveau,
        methode: body.methode,
        periodNumber: body.periodNumber,
        weekNumber: body.weekNumber,
      });
      return NextResponse.json({ route: ROUTE_PATH, session });
    }

    if (body.action === "save" && body.parsed) {
      const session = await buildSeanceImportSession({
        parsed: body.parsed,
        title: body.title,
        matiere: body.matiere,
        sousMatiere: body.sousMatiere,
        niveau: body.niveau,
        methode: body.methode,
        periodNumber: body.periodNumber,
        weekNumber: body.weekNumber,
      });

      if (body.selectedLinks) {
        session.selectedLinks = body.selectedLinks;
      }

      logRouteInfo(ROUTE_PATH, "Sauvegarde séances importées", {
        title: session.title,
        count: session.drafts.length,
      });

      const payload = await saveImportedSeances({
        session,
        sourceFileName: body.sourceFileName,
        sourceStoragePath: body.sourceStoragePath,
      });

      for (const seance of payload.seances) {
        void triggerPedagogicalAnalysis({
          reason: "import",
          module: "seance",
          entityId: seance.seance.id,
        });
      }

      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action ou paramètres invalides.");
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, toErrorMessage(error) || "Import séance impossible.");
  }
}
