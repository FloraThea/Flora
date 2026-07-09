import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { DocumentExtractionError } from "@/lib/documents/extract-text";
import { importDocumentFromFile } from "@/lib/documents/import-document";

const ROUTE_PATH = "/api/thea/upload-resource";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.", "Le champ `file` est requis.");
    }

    logRouteInfo(ROUTE_PATH, "Fichier reçu", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    const result = await importDocumentFromFile(file);

    logRouteInfo(ROUTE_PATH, "Import ressource terminé", {
      fileName: file.name,
      documentId: result.document.id,
      chunks: result.chunks.length,
      tags: result.tags.length,
      competences: result.competences.length,
      warning: result.warning ?? null,
    });

    return NextResponse.json(
      {
        route: ROUTE_PATH,
        ...result,
      },
      { status: result.warning ? 207 : 200 },
    );
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return jsonRouteError(ROUTE_PATH, 400, error.message, "Extraction texte impossible.");
    }

    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'importer la ressource.",
      toErrorMessage(error),
    );
  }
}
