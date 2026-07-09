import { NextResponse } from "next/server";
import { getExplorerPayload } from "@/lib/knowledge/pipeline";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { error: "Paramètre id requis." },
        { status: 400 },
      );
    }

    const payload = await getExplorerPayload(documentId);

    if (!payload) {
      return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/knowledge/explorer :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger l'explorateur.",
      },
      { status: 500 },
    );
  }
}
