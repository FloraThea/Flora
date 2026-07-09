import { NextResponse } from "next/server";
import { searchDocuments } from "@/lib/documents/document-service";
import type { DocumentSearchFilters } from "@/lib/documents/types";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";

export async function POST(request: Request) {
  let filters: DocumentSearchFilters = {};

  try {
    filters = (await request.json()) as DocumentSearchFilters;

    console.info("[/api/documents/search] Requête reçue", {
      filters,
    });

    const documents = await searchDocuments(filters);

    console.info("[/api/documents/search] Succès", {
      count: documents.length,
      query: filters.query ?? "",
    });

    return NextResponse.json({ documents });
  } catch (error) {
    const details = serializeSupabaseError(error);

    console.error("[/api/documents/search] Échec", {
      filters,
      ...details,
    });

    return NextResponse.json(
      {
        error: getSupabaseErrorMessage(error, "Impossible de rechercher les documents."),
        details,
      },
      { status: 500 },
    );
  }
}
