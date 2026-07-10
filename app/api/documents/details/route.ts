import { NextResponse } from "next/server";
import { getDocumentDetails } from "@/lib/documents/document-service";
import { logRouteInfo } from "@/lib/api/route-diagnostics";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant du document requis." },
        { status: 400 },
      );
    }

    logRouteInfo("/api/documents/details", "Requête reçue", { id });

    const document = await getDocumentDetails(id);

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable." },
        { status: 404 },
      );
    }

    logRouteInfo("/api/documents/details", "Succès", {
      id,
      chunks: document.document_chunks.length,
      tags: document.document_tags.length,
    });

    return NextResponse.json({ document });
  } catch (error) {
    const details = serializeSupabaseError(error);
    console.error("[/api/documents/details] Échec", details);

    return NextResponse.json(
      {
        error: getSupabaseErrorMessage(error, "Impossible de charger le document."),
        details,
      },
      { status: 500 },
    );
  }
}
