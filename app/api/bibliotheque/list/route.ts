import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { listUnifiedLibrary } from "@/lib/library/unified-library-service";
import type { LibrarySearchFilters } from "@/lib/library/types";

const ROUTE_PATH = "/api/bibliotheque/list";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: LibrarySearchFilters = {
      query: searchParams.get("query") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      discipline: searchParams.get("discipline") ?? undefined,
      niveau: searchParams.get("niveau") ?? undefined,
      methode: searchParams.get("methode") ?? undefined,
      format: searchParams.get("format") ?? undefined,
      sort: (searchParams.get("sort") as LibrarySearchFilters["sort"]) ?? "date",
    };

    const payload = await listUnifiedLibrary(filters);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Impossible de charger la bibliothèque.", toErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LibrarySearchFilters;
    const payload = await listUnifiedLibrary(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Impossible de charger la bibliothèque.", toErrorMessage(error));
  }
}
