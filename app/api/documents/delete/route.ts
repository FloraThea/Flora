import { NextResponse } from "next/server";
import { archiveDocument } from "@/lib/documents/document-service";

/** Suppression douce : le document reste en base, marqué comme archivé. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Identifiant du document requis." },
        { status: 400 },
      );
    }

    const document = await archiveDocument(body.id);

    return NextResponse.json({
      success: true,
      document,
      message: "Document retiré de la bibliothèque sans suppression des données.",
    });
  } catch (error) {
    console.error("Erreur /api/documents/delete :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de retirer le document.",
      },
      { status: 500 },
    );
  }
}
