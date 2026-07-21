import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { DocumentExtractionError, extractTextFromFile } from "@/lib/documents/extract-text";
import { runBoImportAndExtractStep } from "@/lib/referentiel/bo-pipeline";

const ROUTE_PATH = "/api/centre-ressources/import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.");
    }

    logRouteInfo(ROUTE_PATH, "Import document", { fileName: file.name });

    let extraction;
    try {
      extraction = await extractTextFromFile(file);
      logRouteInfo(ROUTE_PATH, "Extraction PDF terminée", {
        fileName: file.name,
        fileSizeBytes: file.size,
        pageCount: extraction.pageCount,
        textLength: extraction.textLength,
        extractionMethod: extraction.extractionMethod,
        usedOcr: extraction.usedOcr,
        pdfKind: extraction.pdfKind ?? null,
        hasTextLayer: extraction.hasTextLayer ?? null,
        durationMs: extraction.diagnostics?.durationMs ?? null,
      });
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        return jsonRouteError(ROUTE_PATH, 400, error.message);
      }
      throw error;
    }

    if (!extraction.text.trim()) {
      return jsonRouteError(ROUTE_PATH, 400, "Le document ne contient pas de texte exploitable.");
    }

    const result = await runBoImportAndExtractStep({ file, extraction });

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      documentId: result.document.id,
      documentStatus: result.document.status,
      fileName: file.name,
      textLength: extraction.textLength,
      pageCount: extraction.pageCount,
      preview: extraction.preview,
      storageWarning: result.storageWarning ?? null,
      pdfArchived: result.pdfArchived ?? false,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Import impossible.", toErrorMessage(error));
  }
}
