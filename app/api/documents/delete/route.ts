import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/documents/document-service";

/** Suppression définitive : document, fichier source et analyse associée. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Identifiant du document requis." },
        { status: 400 },
      );
    }

    await deleteDocument(body.id);

    return NextResponse.json({
      success: true,
      id: body.id,
      message: "Document et analyse supprimés.",
    });
  } catch (error) {
    console.error("Erreur /api/documents/delete :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer le document.",
      },
      { status: 500 },
    );
  }
}
