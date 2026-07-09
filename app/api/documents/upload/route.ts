import { NextResponse } from "next/server";
import { DocumentExtractionError } from "@/lib/documents/extract-text";
import { validateUploadFileSize, IMPORT_CONFIG } from "@/lib/documents/import/config";
import { importDocumentFromFile } from "@/lib/documents/import-document";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier reçu." },
        { status: 400 },
      );
    }

    validateUploadFileSize(file.size, file.name);

    if (file.size > IMPORT_CONFIG.directUploadThresholdBytes) {
      return NextResponse.json(
        {
          error:
            "Fichier trop volumineux pour l'upload direct. Utilisez l'import depuis la bibliothèque (upload par morceaux).",
        },
        { status: 413 },
      );
    }

    const result = await importDocumentFromFile(file);

    return NextResponse.json(result, {
      status: result.warning ? 207 : 200,
    });
  } catch (error) {
    console.error("Erreur /api/documents/upload :", error);

    if (error instanceof DocumentExtractionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'importer le document.",
      },
      { status: 500 },
    );
  }
}
