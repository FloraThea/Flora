import { NextResponse } from "next/server";
import { logStructuredError, serializeError } from "@/lib/api/error-diagnostics";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { DocumentExtractionError, extractTextFromFile } from "@/lib/documents/extract-text";
import {
  runBoAnalyzeStep,
  runBoImportAndExtractStep,
} from "@/lib/referentiel/bo-pipeline";
import { GeminiExhaustedError } from "@/lib/thea/services/gemini-errors";
import { GEMINI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";

const ROUTE_PATH = "/api/referentiel-bo/analyse-bo";

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
    const documentId = formData.get("documentId");

    if (documentId && typeof documentId === "string") {
      const result = await runBoAnalyzeStep(documentId);
      return NextResponse.json({
        route: ROUTE_PATH,
        success: true,
        documentId: result.document.id,
        documentStatus: result.document.status,
        referencesCount: result.validation.totalCompetences,
        insertedCount: result.insertedCount,
        validation: result.validation,
      });
    }

    if (!(file instanceof File)) {
      return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.", "Le champ `file` est requis.");
    }

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

    if (!extraction.text.trim()) {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Le document ne contient pas de texte exploitable.",
        "Vérifiez que le PDF n'est pas uniquement composé d'images scannées.",
        { fileName: file.name, fileSize: file.size },
      );
    }

    try {
      const imported = await runBoImportAndExtractStep({ file, extraction });

      try {
        const result = await runBoAnalyzeStep(imported.document.id);

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
          niveau: result.document.niveau ?? "",
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
          pdfArchived: imported.pdfArchived ?? false,
          storageBucket: imported.storageBucket ?? null,
          storageWarning: imported.storageWarning ?? null,
        });
      } catch (analyzeError) {
        const isGeminiOverload =
          analyzeError instanceof GeminiExhaustedError ||
          toErrorMessage(analyzeError).toUpperCase().includes("503");

        return jsonRouteError(
          ROUTE_PATH,
          503,
          isGeminiOverload
            ? GEMINI_QUEUE_USER_MESSAGE
            : "Analyse Théa indisponible. Le texte a été sauvegardé — relancez l'analyse plus tard.",
          toErrorMessage(analyzeError),
          {
            documentId: imported.document.id,
            documentStatus: imported.document.status,
            textLength: extraction.textLength,
            storageWarning: imported.storageWarning ?? null,
          },
          analyzeError,
        );
      }
    } catch (importError) {
      throw importError;
    }
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Analyse BO échouée.",
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
