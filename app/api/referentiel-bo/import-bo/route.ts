import { NextResponse } from "next/server";
import { logStructuredError, serializeError } from "@/lib/api/error-diagnostics";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { DocumentExtractionError, extractTextFromFile } from "@/lib/documents/extract-text";
import { runBoAnalysePipeline } from "@/lib/referentiel/bo-pipeline";

const ROUTE_PATH = "/api/referentiel-bo/import-bo";

export async function POST(request: Request) {
  const requestMeta = {
    route: ROUTE_PATH,
    method: request.method,
    url: request.url,
  };

  logRouteInfo(ROUTE_PATH, "Requête reçue", requestMeta);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.", "Le champ `file` est requis.");
    }

    logRouteInfo(ROUTE_PATH, "Fichier reçu", {
      ...requestMeta,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    let extraction;

    try {
      extraction = await extractTextFromFile(file);
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        logStructuredError(
          ROUTE_PATH,
          "Extraction texte refusée",
          { ...requestMeta, fileName: file.name, fileSize: file.size },
          error,
        );
        return jsonRouteError(
          ROUTE_PATH,
          400,
          error.message,
          `Extraction impossible (${error.reason}).`,
          {
            fileName: file.name,
            fileSize: file.size,
            reason: error.reason,
            pageCount: error.pageCount,
            textLength: error.textLength,
            preview: error.preview,
          },
          error,
        );
      }
      throw error;
    }

    logRouteInfo(ROUTE_PATH, "Texte extrait", {
      ...requestMeta,
      fileName: file.name,
      extractionMethod: extraction.extractionMethod,
      pageCount: extraction.pageCount,
      textLength: extraction.textLength,
      usedOcr: extraction.usedOcr,
      preview: extraction.preview,
    });

    if (!extraction.text.trim()) {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Le document ne contient pas de texte exploitable.",
        "Vérifiez que le PDF n'est pas uniquement composé d'images scannées.",
        { fileName: file.name, fileSize: file.size },
      );
    }

    const result = await runBoAnalysePipeline({ file, extraction });

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      savedToLibrary: false,
      fileName: file.name,
      documentId: result.document.id,
      documentStatus: result.document.status,
      activeForProgrammation: result.document.active_for_programmation,
      cycle: result.document.cycle,
      matiere: result.document.matiere,
      domaine: result.document.domaine,
      extractionMethod: extraction.extractionMethod,
      usedOcr: extraction.usedOcr,
      pageCount: extraction.pageCount,
      textLength: extraction.textLength,
      preview: extraction.preview,
      referencesCount: result.validation.totalCompetences,
      insertedCount: result.insertedCount,
      sectionsProcessed: result.sectionsProcessed,
      validation: result.validation,
      competences: result.competences.slice(0, 120),
      pdfArchived: result.pdfArchived ?? false,
      storageBucket: result.storageBucket ?? null,
      storageWarning: result.storageWarning ?? null,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Import BO échoué.",
      toErrorMessage(error),
      {
        method: request.method,
        url: request.url,
        error: serializeError(error),
      },
      error,
    );
  }
}
