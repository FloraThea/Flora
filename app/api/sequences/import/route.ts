import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  analyzeSequenceImport,
  buildSequenceImportSession,
  requireSequenceImportProfileId,
  saveImportedSequences,
  uploadSequenceImportFile,
} from "@/lib/sequences/import/sequence-import-service";
import type { ParsedSequenceImport } from "@/lib/sequences/import/types";
import { triggerPedagogicalAnalysis } from "@/lib/pedagogical/intelligence/coherence-trigger";

const ROUTE_PATH = "/api/sequences/import";

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
        const parsed = await analyzeSequenceImport({
          fileName: file.name,
          buffer,
          mimeType: file.type,
          pastedText: pastedText || undefined,
        });
        return NextResponse.json({ route: ROUTE_PATH, parsed });
      }

      if (action === "upload") {
        const profileId = await requireSequenceImportProfileId();
        const uploaded = await uploadSequenceImportFile(profileId, file);
        return NextResponse.json({ route: ROUTE_PATH, ...uploaded });
      }

      return jsonRouteError(ROUTE_PATH, 400, "Action non reconnue.");
    }

    const body = (await request.json()) as {
      action?: string;
      parsed?: ParsedSequenceImport;
      title?: string;
      matiere?: string;
      sousMatiere?: string;
      niveau?: string;
      methode?: string;
      sourceStoragePath?: string;
      sourceFileName?: string;
      selectedLinks?: ParsedSequenceImport extends never ? never : import("@/lib/sequences/import/types").SequenceImportSession["selectedLinks"];
      pastedText?: string;
      fileName?: string;
    };

    action = body.action;

    if (body.action === "analyze_text") {
      const parsed = await analyzeSequenceImport({
        fileName: body.fileName ?? "sequence.txt",
        buffer: Buffer.from(body.pastedText ?? "", "utf8"),
        pastedText: body.pastedText,
      });
      return NextResponse.json({ route: ROUTE_PATH, parsed });
    }

    if (body.action === "preview" && body.parsed) {
      const session = await buildSequenceImportSession({
        parsed: body.parsed,
        title: body.title,
        matiere: body.matiere,
        sousMatiere: body.sousMatiere,
        niveau: body.niveau,
        methode: body.methode,
      });
      return NextResponse.json({ route: ROUTE_PATH, session });
    }

    if (body.action === "save" && body.parsed) {
      const session = await buildSequenceImportSession({
        parsed: body.parsed,
        title: body.title,
        matiere: body.matiere,
        sousMatiere: body.sousMatiere,
        niveau: body.niveau,
        methode: body.methode,
      });

      if (body.selectedLinks) {
        session.selectedLinks = body.selectedLinks;
      }

      logRouteInfo(ROUTE_PATH, "Sauvegarde séquences importées", {
        title: session.title,
        count: session.drafts.length,
      });

      const payload = await saveImportedSequences({
        session,
        sourceFileName: body.sourceFileName,
        sourceStoragePath: body.sourceStoragePath,
      });

      for (const sequence of payload.sequences) {
        void triggerPedagogicalAnalysis({
          reason: "import",
          module: "sequence",
          entityId: sequence.sequence.id,
        });
      }

      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action ou paramètres invalides.");
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, toErrorMessage(error) || "Import séquence impossible.");
  }
}
