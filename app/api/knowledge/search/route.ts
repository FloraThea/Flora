import { NextResponse } from "next/server";
import { searchEngine } from "@/lib/knowledge/SearchEngine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string; limit?: number };
    const query = body.query?.trim() ?? "";
    const limit = body.limit ?? 20;

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchEngine.search(query, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erreur /api/knowledge/search :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de lancer la recherche intelligente.",
      },
      { status: 500 },
    );
  }
}
