import { NextResponse } from "next/server";
import { searchPedagogicalDocuments } from "@/lib/pedagogical/intelligence/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limit = Number(searchParams.get("limit") ?? 20);
    const offset = Number(searchParams.get("offset") ?? 0);

    const result = await searchPedagogicalDocuments({ query, limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recherche indisponible." },
      { status: 500 },
    );
  }
}
