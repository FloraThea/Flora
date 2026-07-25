import { NextResponse } from "next/server";
import { trashDocument } from "@/lib/documents/document-service";

/** Place un document dans la corbeille (suppression réversible). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; reason?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Identifiant du document requis." },
        { status: 400 },
      );
    }

    const document = await trashDocument(body.id, body.reason);

    return NextResponse.json({
      success: true,
      id: body.id,
      document,
      message: "Document placé dans la Corbeille.",
    });
  } catch (error) {
    console.error("Erreur /api/documents/trash :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de placer le document dans la Corbeille.",
      },
      { status: 500 },
    );
  }
}
